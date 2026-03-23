import { getInventoryLimitForPlayer } from "../../inventoryLimit.js";
import { logEvent } from "../../events.js";
import { getSinglePartyId } from "../../db.js";
import { jsonParse, now } from "../../util.js";
import {
  ensurePlayerLayoutSlots,
  findItemAtSlot,
  getNextInventorySlot,
  getRequestedSlot,
  isPlacementAllowedForItem,
  isValidSlot,
  mapInventoryRow,
  normalizeIdList,
  normalizeInventoryContainer,
  normalizeSlotCoord
} from "../../routes/inventoryDomain.js";
import { checkWeightLimit, toFiniteNumber } from "./inventoryServiceUtils.js";

function ok(body) {
  return { ok: true, status: 200, body };
}

function error(status, code, extra = null) {
  return { ok: false, status, body: extra ? { error: code, ...extra } : { error: code } };
}

function emitInventory(io, playerIds = []) {
  for (const playerId of new Set(playerIds.map((id) => Number(id)).filter(Boolean))) {
    io?.to(`player:${playerId}`).emit("inventory:updated");
  }
  io?.to("dm").emit("inventory:updated");
}

function emitInventoryAndTransfers(io, playerIds = [], transferPlayerIds = []) {
  emitInventory(io, playerIds);
  for (const playerId of new Set(transferPlayerIds.map((id) => Number(id)).filter(Boolean))) {
    io?.to(`player:${playerId}`).emit("transfers:updated");
  }
  io?.to("dm").emit("transfers:updated");
}

function actorInfoFromSession(sess) {
  return {
    actorRole: sess.impersonated ? "dm" : "player",
    actorPlayerId: sess.player_id,
    actorName: sess.impersonated ? "DM (impersonation)" : null,
    updatedBy: sess.impersonated ? "dm" : "player",
    partyId: sess.party_id
  };
}

function normalizeItemPayload(body, existing = null) {
  const b = body || {};
  const name = String(b.name ?? existing?.name ?? "").trim();
  const qty = Math.max(1, toFiniteNumber(b.qty ?? existing?.qty ?? 1, existing?.qty ?? 1));
  const weight = Math.max(0, toFiniteNumber(b.weight ?? existing?.weight ?? 0, existing?.weight ?? 0));
  const rarity = String(b.rarity ?? existing?.rarity ?? "common");
  const visibility = (b.visibility ?? existing?.visibility) === "hidden" ? "hidden" : "public";
  const tags = Array.isArray(b.tags) ? b.tags.map(String) : jsonParse(existing?.tags, []);
  const description = String(b.description ?? existing?.description ?? "");
  const imageUrl = String(b.imageUrl ?? b.image_url ?? existing?.image_url ?? "");
  return { name, qty, weight, rarity, visibility, tags, description, imageUrl };
}

function resolveTargetSlot(db, playerId, body, fallbackContainer) {
  const requestedContainer = normalizeInventoryContainer(body?.container ?? body?.inv_container ?? fallbackContainer);
  const requestedSlot = getRequestedSlot(body || {});
  if (requestedSlot?.error) return { error: requestedSlot.error };
  const slot = requestedSlot || getNextInventorySlot(db, playerId, requestedContainer);
  if (!slot) return { error: "inventory_full" };
  return { slot };
}

function createInventoryItem({
  db,
  io,
  playerId,
  audit,
  body,
  logType,
  logMessage,
  logData
}) {
  const payload = normalizeItemPayload(body);
  if (!payload.name) return error(400, "name_required");

  const limitInfo = getInventoryLimitForPlayer(db, playerId);
  const weightError = checkWeightLimit(db, playerId, {
    nextQty: payload.qty,
    nextWeight: payload.weight,
    limitOverride: limitInfo.limit
  });
  if (weightError) {
    return error(weightError.status, weightError.error, {
      limit: weightError.limit,
      projected: weightError.projected
    });
  }

  ensurePlayerLayoutSlots(db, playerId);
  const slotResult = resolveTargetSlot(db, playerId, body, body?.container ?? body?.inv_container);
  if (slotResult.error) return error(400, slotResult.error);
  const { slot } = slotResult;

  const occupiedBy = findItemAtSlot(db, playerId, slot.container, slot.slotX, slot.slotY);
  if (occupiedBy) return error(409, "slot_occupied", { itemId: Number(occupiedBy.id) });
  if (!isPlacementAllowedForItem({
    name: payload.name,
    description: payload.description,
    rarity: payload.rarity,
    tags: payload.tags
  }, slot.container, slot.slotX)) {
    return error(400, "invalid_equipment_slot");
  }

  const t = now();
  const id = db.prepare(
    "INSERT INTO inventory_items(player_id, name, description, image_url, qty, weight, rarity, tags, visibility, inv_container, slot_x, slot_y, updated_at, updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).run(
    playerId,
    payload.name,
    payload.description,
    payload.imageUrl || null,
    payload.qty,
    payload.weight,
    payload.rarity,
    JSON.stringify(payload.tags),
    payload.visibility,
    slot.container,
    slot.slotX,
    slot.slotY,
    t,
    audit.updatedBy
  ).lastInsertRowid;

  logEvent({
    partyId: audit.partyId,
    type: logType,
    actorRole: audit.actorRole,
    actorPlayerId: audit.actorPlayerId,
    actorName: audit.actorName,
    targetType: "inventory_item",
    targetId: Number(id),
    message: logMessage(payload, playerId),
    data: logData(payload, playerId),
    io
  });

  emitInventory(io, [playerId]);
  return ok({ ok: true, id: Number(id) });
}

function updateInventoryItem({
  db,
  io,
  playerId,
  itemId,
  audit,
  body,
  logType,
  logMessage,
  logData
}) {
  ensurePlayerLayoutSlots(db, playerId);
  const existing = db.prepare("SELECT * FROM inventory_items WHERE id=? AND player_id=?").get(itemId, playerId);
  if (!existing) return error(404, "not_found");

  const payload = normalizeItemPayload(body, existing);
  if (!payload.name) return error(400, "name_required");

  const container = normalizeInventoryContainer(body?.container ?? body?.inv_container ?? existing.inv_container);
  const slotX = normalizeSlotCoord(body?.slotX ?? body?.slot_x ?? existing.slot_x);
  const slotY = normalizeSlotCoord(body?.slotY ?? body?.slot_y ?? existing.slot_y);
  if (!isValidSlot(container, slotX, slotY)) return error(400, "invalid_slot");

  const occupiedBy = findItemAtSlot(db, playerId, container, slotX, slotY, itemId);
  if (occupiedBy) return error(409, "slot_occupied", { itemId: Number(occupiedBy.id) });
  if (!isPlacementAllowedForItem({
    name: payload.name,
    description: payload.description,
    rarity: payload.rarity,
    tags: payload.tags
  }, container, slotX)) {
    return error(400, "invalid_equipment_slot");
  }

  const reservedQty = Number(existing.reserved_qty || 0);
  if (payload.qty < reservedQty) return error(400, "reserved_qty_exceeded");

  const limitInfo = getInventoryLimitForPlayer(db, playerId);
  const weightError = checkWeightLimit(db, playerId, {
    nextQty: payload.qty,
    nextWeight: payload.weight,
    excludeItemId: itemId,
    limitOverride: limitInfo.limit
  });
  if (weightError) {
    return error(weightError.status, weightError.error, {
      limit: weightError.limit,
      projected: weightError.projected
    });
  }

  db.prepare(
    "UPDATE inventory_items SET name=?, description=?, image_url=?, qty=?, weight=?, rarity=?, tags=?, visibility=?, inv_container=?, slot_x=?, slot_y=?, updated_at=?, updated_by=? WHERE id=?"
  ).run(
    payload.name,
    payload.description,
    payload.imageUrl || null,
    payload.qty,
    payload.weight,
    payload.rarity,
    JSON.stringify(payload.tags),
    payload.visibility,
    container,
    slotX,
    slotY,
    now(),
    audit.updatedBy,
    itemId
  );

  logEvent({
    partyId: audit.partyId,
    type: logType,
    actorRole: audit.actorRole,
    actorPlayerId: audit.actorPlayerId,
    actorName: audit.actorName,
    targetType: "inventory_item",
    targetId: Number(itemId),
    message: logMessage(payload, playerId),
    data: logData(payload, playerId),
    io
  });

  emitInventory(io, [playerId]);
  return ok({ ok: true });
}

export function listInventoryForPlayer({ db, playerId, includeWeightLimit = false }) {
  ensurePlayerLayoutSlots(db, playerId);
  const items = db.prepare(
    "SELECT * FROM inventory_items WHERE player_id=? ORDER BY inv_container ASC, slot_y ASC, slot_x ASC, id DESC"
  ).all(playerId).map(mapInventoryRow);
  if (!includeWeightLimit) return ok({ items });
  const limitInfo = getInventoryLimitForPlayer(db, playerId);
  return ok({
    items,
    weightLimit: limitInfo.limit,
    weightLimitBase: limitInfo.base,
    weightLimitRace: limitInfo.race,
    weightLimitBonus: limitInfo.bonus
  });
}

export function processPlayerInventoryCreate({ db, io, sess, body }) {
  return createInventoryItem({
    db,
    io,
    playerId: sess.player_id,
    audit: actorInfoFromSession(sess),
    body,
    logType: "inventory.created",
    logMessage: (payload) => `Добавлен предмет: ${payload.name}`,
    logData: (payload) => ({ playerId: sess.player_id, visibility: payload.visibility, qty: payload.qty })
  });
}

export function processDmInventoryCreate({ db, io, playerId, body }) {
  const player = db.prepare("SELECT id, party_id FROM players WHERE id=?").get(playerId);
  if (!player) return error(404, "player_not_found");
  return createInventoryItem({
    db,
    io,
    playerId,
    audit: {
      actorRole: "dm",
      actorName: "DM",
      updatedBy: "dm",
      partyId: player.party_id
    },
    body,
    logType: "inventory.granted",
    logMessage: (payload) => `DM выдал предмет "${payload.name}" игроку #${playerId}`,
    logData: (payload) => ({ playerId, visibility: payload.visibility, qty: payload.qty })
  });
}

export function processPlayerInventoryUpdate({ db, io, sess, itemId, body }) {
  return updateInventoryItem({
    db,
    io,
    playerId: sess.player_id,
    itemId,
    audit: actorInfoFromSession(sess),
    body,
    logType: "inventory.updated",
    logMessage: (payload) => `Изменён предмет: ${payload.name}`,
    logData: (payload) => ({ playerId: sess.player_id, visibility: payload.visibility, qty: payload.qty })
  });
}

export function processDmInventoryUpdate({ db, io, playerId, itemId, body, fallbackPartyId = null }) {
  const partyId = db.prepare("SELECT party_id FROM players WHERE id=?").get(playerId)?.party_id ?? fallbackPartyId ?? getSinglePartyId();
  return updateInventoryItem({
    db,
    io,
    playerId,
    itemId,
    audit: {
      actorRole: "dm",
      actorName: "DM",
      updatedBy: "dm",
      partyId
    },
    body,
    logType: "inventory.updated",
    logMessage: (payload) => `DM изменил предмет "${payload.name}" игроку #${playerId}`,
    logData: (payload) => ({ playerId, visibility: payload.visibility, qty: payload.qty })
  });
}

export function processPlayerInventoryDelete({ db, io, sess, itemId }) {
  const row = db.prepare("SELECT name, reserved_qty FROM inventory_items WHERE id=? AND player_id=?").get(itemId, sess.player_id);
  if (!row) return error(404, "not_found");
  if (Number(row.reserved_qty || 0) > 0) return error(400, "transfer_pending");
  db.prepare("DELETE FROM inventory_items WHERE id=? AND player_id=?").run(itemId, sess.player_id);

  logEvent({
    partyId: sess.party_id,
    type: "inventory.deleted",
    actorRole: sess.impersonated ? "dm" : "player",
    actorPlayerId: sess.player_id,
    actorName: sess.impersonated ? "DM (impersonation)" : null,
    targetType: "inventory_item",
    targetId: Number(itemId),
    message: `Удалён предмет: ${row?.name || itemId}`,
    data: { playerId: sess.player_id },
    io
  });

  emitInventory(io, [sess.player_id]);
  return ok({ ok: true });
}

export function processDmInventoryDelete({ db, io, playerId, itemId, fallbackPartyId = null }) {
  const row = db.prepare("SELECT name, reserved_qty FROM inventory_items WHERE id=? AND player_id=?").get(itemId, playerId);
  if (!row) return error(404, "not_found");
  const recipients = db.prepare(
    "SELECT DISTINCT to_player_id AS pid FROM item_transfers WHERE item_id=? AND status='pending'"
  ).all(itemId).map((entry) => Number(entry.pid));

  const tx = db.transaction(() => {
    db.prepare("UPDATE item_transfers SET status='canceled' WHERE item_id=? AND status='pending'").run(itemId);
    db.prepare("DELETE FROM inventory_items WHERE id=? AND player_id=?").run(itemId, playerId);
  });
  tx();

  const partyId = db.prepare("SELECT party_id FROM players WHERE id=?").get(playerId)?.party_id ?? fallbackPartyId ?? getSinglePartyId();
  logEvent({
    partyId,
    type: "inventory.deleted",
    actorRole: "dm",
    actorName: "DM",
    targetType: "inventory_item",
    targetId: Number(itemId),
    message: `DM удалил предмет "${row?.name || itemId}" у игрока #${playerId}`,
    data: { playerId },
    io
  });

  emitInventoryAndTransfers(io, [playerId], [playerId, ...recipients]);
  return ok({ ok: true });
}

export function processDmInventoryBulkVisibility({ db, io, playerId, body }) {
  if (!playerId) return error(400, "invalid_playerId");
  const visibility = body?.visibility === "hidden" ? "hidden" : "public";
  const itemIds = normalizeIdList(body?.itemIds, 500);
  if (!itemIds.length) return error(400, "empty_item_ids");

  const player = db.prepare("SELECT id, party_id FROM players WHERE id=?").get(playerId);
  if (!player) return error(404, "player_not_found");

  const placeholders = itemIds.map(() => "?").join(",");
  const t = now();
  const result = db.prepare(
    `UPDATE inventory_items
     SET visibility=?, updated_at=?, updated_by='dm'
     WHERE player_id=?
       AND id IN (${placeholders})`
  ).run(visibility, t, playerId, ...itemIds);

  logEvent({
    partyId: player.party_id,
    type: "inventory.bulk_visibility",
    actorRole: "dm",
    actorName: "DM",
    targetType: "player",
    targetId: Number(playerId),
    message: `DM updated visibility for ${result.changes || 0} item(s) of player #${playerId}`,
    data: { playerId, visibility, itemIds, updated: result.changes || 0 },
    io
  });

  emitInventory(io, [playerId]);
  return ok({ ok: true, updated: result.changes || 0 });
}

export function processDmInventoryBulkDelete({ db, io, playerId, body }) {
  if (!playerId) return error(400, "invalid_playerId");
  const itemIds = normalizeIdList(body?.itemIds, 500);
  if (!itemIds.length) return error(400, "empty_item_ids");

  const player = db.prepare("SELECT id, party_id FROM players WHERE id=?").get(playerId);
  if (!player) return error(404, "player_not_found");

  const placeholders = itemIds.map(() => "?").join(",");
  const itemRows = db.prepare(
    `SELECT id
     FROM inventory_items
     WHERE player_id=?
       AND id IN (${placeholders})`
  ).all(playerId, ...itemIds);
  const existingIds = itemRows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);
  if (!existingIds.length) return ok({ ok: true, deleted: 0 });

  const existingPlaceholders = existingIds.map(() => "?").join(",");
  const recipients = db.prepare(
    `SELECT DISTINCT to_player_id AS pid
     FROM item_transfers
     WHERE status='pending'
       AND item_id IN (${existingPlaceholders})`
  ).all(...existingIds).map((row) => Number(row.pid)).filter((id) => Number.isInteger(id) && id > 0);

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE item_transfers
       SET status='canceled'
       WHERE status='pending'
         AND item_id IN (${existingPlaceholders})`
    ).run(...existingIds);
    return db.prepare(
      `DELETE FROM inventory_items
       WHERE player_id=?
         AND id IN (${existingPlaceholders})`
    ).run(playerId, ...existingIds);
  });
  const deleted = tx()?.changes || 0;

  logEvent({
    partyId: player.party_id,
    type: "inventory.bulk_deleted",
    actorRole: "dm",
    actorName: "DM",
    targetType: "player",
    targetId: Number(playerId),
    message: `DM deleted ${deleted} item(s) from player #${playerId}`,
    data: { playerId, itemIds: existingIds, deleted },
    io
  });

  emitInventoryAndTransfers(io, [playerId], [playerId, ...recipients]);
  return ok({ ok: true, deleted });
}
