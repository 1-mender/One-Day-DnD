import { now } from "../../util.js";
import {
  INVENTORY_CONTAINER_BACKPACK,
  INVENTORY_CONTAINER_EQUIPMENT,
  allowedEquipmentSlotsForItem,
  ensurePlayerLayoutSlots,
  findItemAtSlot,
  getNextInventorySlot,
  getRequestedSlot,
  isPlacementAllowedForItem,
  isValidSlot,
  makeSlotKey,
  normalizeInventoryContainer,
  normalizeSlotCoord,
  parseLayoutMoves
} from "../../routes/inventoryDomain.js";
import { toFiniteNumber, transferError } from "./inventoryServiceUtils.js";

function ok(body) {
  return { ok: true, status: 200, body };
}

function error(status, code, extra = null) {
  return { ok: false, status, body: extra ? { error: code, ...extra } : { error: code } };
}

function emitInventory(io, playerId) {
  io?.to(`player:${playerId}`).emit("inventory:updated");
  io?.to("dm").emit("inventory:updated");
}

export function processInventoryLayoutUpdate({ db, io, sess, body }) {
  const parsed = parseLayoutMoves(body?.moves, 500);
  if (!parsed.ok) return error(400, parsed.error);

  ensurePlayerLayoutSlots(db, sess.player_id);
  const moves = parsed.moves;
  const placeholders = moves.map(() => "?").join(",");
  const ids = moves.map((move) => move.id);
  const rows = db.prepare(
    `SELECT id, inv_container, slot_x, slot_y, name, description, rarity, tags
     FROM inventory_items
     WHERE player_id=?
       AND id IN (${placeholders})`
  ).all(sess.player_id, ...ids);
  if (rows.length !== moves.length) return error(404, "not_found");

  const byId = new Map(rows.map((row) => [Number(row.id), row]));
  const occupied = new Map();
  const movedIds = new Set(moves.map((move) => move.id));

  const allRows = db.prepare(
    "SELECT id, inv_container, slot_x, slot_y FROM inventory_items WHERE player_id=?"
  ).all(sess.player_id);
  for (const row of allRows) {
    const id = Number(row.id);
    if (movedIds.has(id)) continue;
    const container = normalizeInventoryContainer(row.inv_container);
    const slotX = normalizeSlotCoord(row.slot_x);
    const slotY = normalizeSlotCoord(row.slot_y);
    if (!isValidSlot(container, slotX, slotY)) continue;
    occupied.set(makeSlotKey(container, slotX, slotY), id);
  }

  for (const move of moves) {
    const item = byId.get(move.id);
    if (!item) return error(404, "not_found");
    if (!isPlacementAllowedForItem(item, move.container, move.slotX)) {
      return error(400, "invalid_equipment_slot", { itemId: move.id });
    }
    const key = makeSlotKey(move.container, move.slotX, move.slotY);
    if (occupied.has(key)) return error(409, "slot_occupied", { itemId: occupied.get(key) });
    occupied.set(key, move.id);
  }

  const t = now();
  const stmt = db.prepare(
    "UPDATE inventory_items SET inv_container=?, slot_x=?, slot_y=?, updated_at=?, updated_by=? WHERE id=? AND player_id=?"
  );
  const tx = db.transaction(() => {
    for (const move of moves) {
      stmt.run(
        move.container,
        move.slotX,
        move.slotY,
        t,
        sess.impersonated ? "dm" : "player",
        move.id,
        sess.player_id
      );
    }
  });
  tx();

  emitInventory(io, sess.player_id);
  return ok({ ok: true, updated: moves.length });
}

export function processInventorySplit({ db, io, sess, itemId, body }) {
  const safeItemId = Number(itemId);
  if (!safeItemId) return error(400, "invalid_id");

  const qty = Math.floor(toFiniteNumber(body?.qty, NaN));
  if (!Number.isFinite(qty) || qty < 1) return error(400, "invalid_qty");

  const requestedSlot = getRequestedSlot(body || {});
  if (requestedSlot?.error) return error(400, requestedSlot.error);
  const preferredContainer = normalizeInventoryContainer(body?.container ?? body?.inv_container);

  ensurePlayerLayoutSlots(db, sess.player_id);
  const tx = db.transaction(() => {
    const existing = db.prepare("SELECT * FROM inventory_items WHERE id=? AND player_id=?").get(safeItemId, sess.player_id);
    if (!existing) transferError("not_found", 404);
    const totalQty = Number(existing.qty || 0);
    const reservedQty = Number(existing.reserved_qty || 0);
    const available = Math.max(0, totalQty - reservedQty);
    if (qty >= available) transferError("invalid_qty", 400, { available });

    let slot = requestedSlot;
    if (!slot) {
      slot = getNextInventorySlot(
        db,
        sess.player_id,
        preferredContainer || existing.inv_container || INVENTORY_CONTAINER_BACKPACK
      );
    }
    if (!slot) transferError("inventory_full", 409);
    if (!isPlacementAllowedForItem(existing, slot.container, slot.slotX)) {
      transferError("invalid_equipment_slot", 400);
    }
    if (
      normalizeInventoryContainer(existing.inv_container) === normalizeInventoryContainer(slot.container)
      && Number(existing.slot_x) === Number(slot.slotX)
      && Number(existing.slot_y) === Number(slot.slotY)
    ) {
      transferError("invalid_slot", 400);
    }
    const occupiedBy = findItemAtSlot(db, sess.player_id, slot.container, slot.slotX, slot.slotY, existing.id);
    if (occupiedBy) transferError("slot_occupied", 409, { itemId: Number(occupiedBy.id) });

    const t = now();
    db.prepare("UPDATE inventory_items SET qty=?, updated_at=?, updated_by=? WHERE id=? AND player_id=?")
      .run(totalQty - qty, t, sess.impersonated ? "dm" : "player", safeItemId, sess.player_id);

    const splitId = db.prepare(
      "INSERT INTO inventory_items(player_id, name, description, image_url, qty, reserved_qty, weight, rarity, tags, visibility, inv_container, slot_x, slot_y, updated_at, updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).run(
      sess.player_id,
      existing.name,
      existing.description || "",
      existing.image_url || null,
      qty,
      0,
      Number(existing.weight || 0),
      existing.rarity || "common",
      existing.tags || "[]",
      existing.visibility || "public",
      slot.container,
      slot.slotX,
      slot.slotY,
      t,
      sess.impersonated ? "dm" : "player"
    ).lastInsertRowid;

    return { splitId: Number(splitId), slot };
  });

  try {
    const out = tx();
    emitInventory(io, sess.player_id);
    return ok({ ok: true, id: out.splitId, slot: out.slot });
  } catch (e) {
    if (e?.code) return error(e.status || 400, e.code, e.extra || null);
    throw e;
  }
}

export function processInventoryQuickEquip({ db, io, sess, itemId }) {
  const safeItemId = Number(itemId);
  if (!safeItemId) return error(400, "invalid_id");

  ensurePlayerLayoutSlots(db, sess.player_id);
  const tx = db.transaction(() => {
    const item = db.prepare("SELECT * FROM inventory_items WHERE id=? AND player_id=?").get(safeItemId, sess.player_id);
    if (!item) transferError("not_found", 404);

    const allowed = allowedEquipmentSlotsForItem(item);
    if (!allowed.length) transferError("not_equipable", 400);

    const currentContainer = normalizeInventoryContainer(item.inv_container);
    const currentX = normalizeSlotCoord(item.slot_x);
    const currentY = normalizeSlotCoord(item.slot_y);
    if (currentContainer === INVENTORY_CONTAINER_EQUIPMENT && currentY === 0 && allowed.includes(currentX)) {
      return { idempotent: true, slotX: currentX, slotY: 0 };
    }

    let targetSlotX = null;
    let occupant = null;
    for (const slotX of allowed) {
      const existing = findItemAtSlot(db, sess.player_id, INVENTORY_CONTAINER_EQUIPMENT, slotX, 0, item.id);
      if (!existing) {
        targetSlotX = slotX;
        occupant = null;
        break;
      }
      if (targetSlotX == null) {
        targetSlotX = slotX;
        occupant = existing;
      }
    }
    if (targetSlotX == null) transferError("equip_slot_not_found", 400);

    const t = now();
    if (occupant?.id) {
      const fallback = getNextInventorySlot(db, sess.player_id, INVENTORY_CONTAINER_BACKPACK);
      if (!fallback) transferError("inventory_full", 409);
      db.prepare(
        "UPDATE inventory_items SET inv_container=?, slot_x=?, slot_y=?, updated_at=?, updated_by=? WHERE id=? AND player_id=?"
      ).run(
        fallback.container,
        fallback.slotX,
        fallback.slotY,
        t,
        sess.impersonated ? "dm" : "player",
        Number(occupant.id),
        sess.player_id
      );
    }

    db.prepare(
      "UPDATE inventory_items SET inv_container=?, slot_x=?, slot_y=?, updated_at=?, updated_by=? WHERE id=? AND player_id=?"
    ).run(
      INVENTORY_CONTAINER_EQUIPMENT,
      targetSlotX,
      0,
      t,
      sess.impersonated ? "dm" : "player",
      safeItemId,
      sess.player_id
    );

    return {
      idempotent: false,
      slotX: targetSlotX,
      slotY: 0,
      swappedItemId: occupant?.id ? Number(occupant.id) : null
    };
  });

  try {
    const out = tx();
    emitInventory(io, sess.player_id);
    return ok({ ok: true, ...out });
  } catch (e) {
    if (e?.code) return error(e.status || 400, e.code, e.extra || null);
    throw e;
  }
}
