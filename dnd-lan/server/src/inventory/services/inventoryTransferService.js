import { now } from "../../util.js";
import { getInventoryLimitForPlayer } from "../../inventoryLimit.js";
import { logEvent } from "../../events.js";
import {
  INVENTORY_CONTAINER_BACKPACK,
  ensurePlayerLayoutSlots,
  findItemAtSlot,
  getNextInventorySlot
} from "../domain/inventoryDomain.js";
import {
  TRANSFER_MAX_QTY,
  TRANSFER_NOTE_MAX,
  TRANSFER_TTL_MS,
  expireTransfer,
  getInventoryTotalWeight,
  parseTransferQty,
  transferError
} from "./inventoryServiceUtils.js";

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

function emitTransfers(io, playerIds = []) {
  for (const playerId of new Set(playerIds.map((id) => Number(id)).filter(Boolean))) {
    io?.to(`player:${playerId}`).emit("transfers:updated");
  }
  io?.to("dm").emit("transfers:updated");
}

function mapInboxRow(row) {
  return {
    id: row.id,
    fromPlayerId: row.from_player_id,
    fromName: row.fromName,
    itemId: row.item_id,
    itemName: row.itemName,
    itemWeight: Number(row.itemWeight || 0),
    qty: Number(row.qty || 0),
    status: row.status,
    note: row.note || "",
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}

function mapOutboxRow(row) {
  return {
    id: row.id,
    toPlayerId: row.to_player_id,
    toName: row.toName,
    itemId: row.item_id,
    itemName: row.itemName,
    itemWeight: Number(row.itemWeight || 0),
    qty: Number(row.qty || 0),
    status: row.status,
    note: row.note || "",
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}

function mapDmRow(row) {
  return {
    id: row.id,
    fromPlayerId: row.from_player_id,
    fromName: row.fromName,
    toPlayerId: row.to_player_id,
    toName: row.toName,
    itemId: row.item_id,
    itemName: row.itemName,
    qty: Number(row.qty || 0),
    status: row.status,
    note: row.note || "",
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}

export function processTransferCreate({ db, io, sess, body, nowFn = now }) {
  const b = body || {};
  const toPlayerId = Number(b.to_player_id);
  const itemId = Number(b.item_id);
  const qty = parseTransferQty(b.qty);
  const note = String(b.note || "").trim();

  if (!toPlayerId || !itemId) return error(400, "invalid_id");
  if (!Number.isFinite(qty) || qty < 1 || qty > TRANSFER_MAX_QTY) return error(400, "invalid_qty");
  if (note.length > TRANSFER_NOTE_MAX) return error(400, "note_too_long");
  if (toPlayerId === sess.player_id) return error(400, "invalid_recipient");

  const tx = db.transaction(() => {
    const recipient = db.prepare("SELECT id, party_id FROM players WHERE id=? AND banned=0").get(toPlayerId);
    if (!recipient || recipient.party_id !== sess.party_id) transferError("forbidden", 403);

    const item = db.prepare("SELECT * FROM inventory_items WHERE id=? AND player_id=?").get(itemId, sess.player_id);
    if (!item) transferError("not_found", 404);

    const reservedQty = Number(item.reserved_qty || 0);
    const totalQty = Number(item.qty || 0);
    const available = totalQty - reservedQty;
    if (qty > available) transferError("not_enough_qty", 400, { available });

    const t = nowFn();
    const expiresAt = t + Math.max(60_000, TRANSFER_TTL_MS);
    db.prepare("UPDATE inventory_items SET reserved_qty=?, updated_at=? WHERE id=?")
      .run(reservedQty + qty, t, itemId);

    const id = db.prepare(
      "INSERT INTO item_transfers(from_player_id, to_player_id, item_id, qty, status, created_at, expires_at, note) VALUES(?,?,?,?,?,?,?,?)"
    ).run(sess.player_id, toPlayerId, itemId, qty, "pending", t, expiresAt, note || null).lastInsertRowid;

    return { id: Number(id), itemName: item.name };
  });

  try {
    const out = tx();
    logEvent({
      partyId: sess.party_id,
      type: "inventory.transfer.requested",
      actorRole: sess.impersonated ? "dm" : "player",
      actorPlayerId: sess.player_id,
      actorName: sess.impersonated ? "DM (impersonation)" : null,
      targetType: "inventory_item",
      targetId: Number(itemId),
      message: `Передача предмета: ${out.itemName || itemId} -> #${toPlayerId} (${qty} шт.)`,
      data: { fromPlayerId: sess.player_id, toPlayerId, itemId, qty },
      io
    });

    emitInventory(io, [sess.player_id, toPlayerId]);
    emitTransfers(io, [sess.player_id, toPlayerId]);
    return ok({ ok: true, id: out.id });
  } catch (e) {
    if (e?.code) return error(e.status || 400, e.code, e.extra || null);
    throw e;
  }
}

export function listTransferInbox({ db, playerId, nowFn = now }) {
  const rows = db.prepare(
    `SELECT tr.*,
            p.display_name as fromName,
            i.name as itemName,
            i.weight as itemWeight
     FROM item_transfers tr
     JOIN players p ON p.id = tr.from_player_id
     JOIN inventory_items i ON i.id = tr.item_id
     WHERE tr.to_player_id=? AND tr.status='pending' AND tr.expires_at>?
     ORDER BY tr.created_at DESC`
  ).all(playerId, nowFn());
  return ok({ items: rows.map(mapInboxRow) });
}

export function listTransferOutbox({ db, playerId, nowFn = now }) {
  const rows = db.prepare(
    `SELECT tr.*,
            p.display_name as toName,
            i.name as itemName,
            i.weight as itemWeight
     FROM item_transfers tr
     JOIN players p ON p.id = tr.to_player_id
     JOIN inventory_items i ON i.id = tr.item_id
     WHERE tr.from_player_id=? AND tr.status='pending' AND tr.expires_at>?
     ORDER BY tr.created_at DESC`
  ).all(playerId, nowFn());
  return ok({ items: rows.map(mapOutboxRow) });
}

export function processTransferAccept({ db, io, sess, transferId, nowFn = now }) {
  const safeTransferId = Number(transferId);
  if (!safeTransferId) return error(400, "invalid_id");

  const tx = db.transaction(() => {
    const tr = db.prepare("SELECT * FROM item_transfers WHERE id=?").get(safeTransferId);
    if (!tr) transferError("transfer_not_found", 404);
    if (tr.to_player_id !== sess.player_id) transferError("forbidden", 403);
    const t = nowFn();
    if (tr.status !== "pending") {
      if (tr.status === "accepted") return { status: tr.status, idempotent: true };
      if (tr.status === "expired") return { status: "expired", expiredAt: tr.expires_at };
      transferError("already_finalized", 400);
    }
    if (tr.expires_at <= t) {
      expireTransfer(db, tr, t);
      return { status: "expired", expiredAt: tr.expires_at };
    }

    const item = db.prepare("SELECT * FROM inventory_items WHERE id=? AND player_id=?").get(tr.item_id, tr.from_player_id);
    if (!item) transferError("transfer_invalid", 400);

    const reservedQty = Number(item.reserved_qty || 0);
    const totalQty = Number(item.qty || 0);
    if (reservedQty < tr.qty || totalQty < tr.qty) transferError("not_enough_qty", 400);

    const limitInfo = getInventoryLimitForPlayer(db, sess.player_id);
    if (limitInfo.limit > 0) {
      const base = getInventoryTotalWeight(db, sess.player_id);
      const projected = base + (Number(item.weight || 0) * Number(tr.qty || 0));
      if (projected > limitInfo.limit && projected > base) {
        transferError("weight_limit_exceeded", 400, { limit: limitInfo.limit, projected });
      }
    }

    const newReserved = reservedQty - tr.qty;
    const newQty = totalQty - tr.qty;
    if (newQty <= 0) {
      db.prepare("DELETE FROM inventory_items WHERE id=?").run(item.id);
    } else {
      db.prepare("UPDATE inventory_items SET qty=?, reserved_qty=?, updated_at=? WHERE id=?")
        .run(newQty, Math.max(0, newReserved), t, item.id);
    }

    ensurePlayerLayoutSlots(db, sess.player_id);
    const slot = getNextInventorySlot(db, sess.player_id, INVENTORY_CONTAINER_BACKPACK);
    if (!slot) transferError("inventory_full", 409);
    const occupiedBy = findItemAtSlot(db, sess.player_id, slot.container, slot.slotX, slot.slotY);
    if (occupiedBy) transferError("inventory_full", 409);
    db.prepare(
      "INSERT INTO inventory_items(player_id, name, description, image_url, qty, weight, rarity, tags, visibility, inv_container, slot_x, slot_y, updated_at, updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).run(
      sess.player_id,
      item.name,
      item.description || "",
      item.image_url || null,
      tr.qty,
      Number(item.weight || 0),
      item.rarity || "common",
      item.tags || "[]",
      item.visibility || "public",
      slot.container,
      slot.slotX,
      slot.slotY,
      t,
      "transfer"
    );
    db.prepare("UPDATE item_transfers SET status=? WHERE id=?").run("accepted", tr.id);
    return { status: "accepted", fromPlayerId: tr.from_player_id, itemName: item.name };
  });

  try {
    const result = tx();
    if (result.status === "expired") {
      return ok({ ok: true, status: "expired", expiredAt: result.expiredAt });
    }

    logEvent({
      partyId: sess.party_id,
      type: "inventory.transfer.accepted",
      actorRole: "player",
      actorPlayerId: sess.player_id,
      targetType: "inventory_item",
      targetId: safeTransferId,
      message: `Принят предмет: ${result.itemName || safeTransferId}`,
      data: { transferId: safeTransferId, toPlayerId: sess.player_id, fromPlayerId: result.fromPlayerId },
      io
    });

    emitInventory(io, [sess.player_id, result.fromPlayerId]);
    emitTransfers(io, [sess.player_id, result.fromPlayerId]);
    return ok({ ok: true, status: result.status, idempotent: !!result.idempotent });
  } catch (e) {
    if (e?.code) return error(e.status || 400, e.code, e.extra || null);
    throw e;
  }
}

export function processTransferReject({ db, io, sess, transferId, nowFn = now }) {
  const safeTransferId = Number(transferId);
  if (!safeTransferId) return error(400, "invalid_id");

  const tx = db.transaction(() => {
    const tr = db.prepare("SELECT * FROM item_transfers WHERE id=?").get(safeTransferId);
    if (!tr) transferError("transfer_not_found", 404);
    if (tr.to_player_id !== sess.player_id) transferError("forbidden", 403);
    const t = nowFn();
    if (tr.status !== "pending") {
      if (tr.status === "rejected") return { status: tr.status, idempotent: true, fromPlayerId: tr.from_player_id };
      if (tr.status === "expired") return { status: "expired", expiredAt: tr.expires_at, fromPlayerId: tr.from_player_id };
      transferError("already_finalized", 400);
    }
    if (tr.expires_at <= t) {
      expireTransfer(db, tr, t);
      return { status: "expired", expiredAt: tr.expires_at, fromPlayerId: tr.from_player_id };
    }

    const item = db.prepare("SELECT * FROM inventory_items WHERE id=? AND player_id=?").get(tr.item_id, tr.from_player_id);
    if (item) {
      const reservedQty = Number(item.reserved_qty || 0);
      const nextReserved = Math.max(0, reservedQty - Number(tr.qty || 0));
      db.prepare("UPDATE inventory_items SET reserved_qty=?, updated_at=? WHERE id=?").run(nextReserved, t, item.id);
    }
    db.prepare("UPDATE item_transfers SET status=? WHERE id=?").run("rejected", tr.id);
    return { status: "rejected", fromPlayerId: tr.from_player_id };
  });

  try {
    const result = tx();
    if (result.status === "expired") {
      return ok({ ok: true, status: "expired", expiredAt: result.expiredAt });
    }

    emitInventory(io, [sess.player_id, result.fromPlayerId]);
    emitTransfers(io, [sess.player_id, result.fromPlayerId]);
    return ok({ ok: true, status: result.status, idempotent: !!result.idempotent });
  } catch (e) {
    if (e?.code) return error(e.status || 400, e.code, e.extra || null);
    throw e;
  }
}

export function processTransferCancel({ db, io, sess, transferId, nowFn = now }) {
  const safeTransferId = Number(transferId);
  if (!safeTransferId) return error(400, "invalid_id");

  const tx = db.transaction(() => {
    const tr = db.prepare("SELECT * FROM item_transfers WHERE id=?").get(safeTransferId);
    if (!tr) transferError("transfer_not_found", 404);
    if (tr.from_player_id !== sess.player_id) transferError("forbidden", 403);
    const t = nowFn();
    if (tr.status !== "pending") {
      if (tr.status === "canceled") return { status: tr.status, idempotent: true, toPlayerId: tr.to_player_id };
      if (tr.status === "expired") return { status: "expired", expiredAt: tr.expires_at, toPlayerId: tr.to_player_id };
      transferError("already_finalized", 400);
    }
    if (tr.expires_at <= t) {
      expireTransfer(db, tr, t);
      return { status: "expired", expiredAt: tr.expires_at, toPlayerId: tr.to_player_id };
    }

    const item = db.prepare("SELECT * FROM inventory_items WHERE id=? AND player_id=?").get(tr.item_id, tr.from_player_id);
    if (item) {
      const reservedQty = Number(item.reserved_qty || 0);
      const nextReserved = Math.max(0, reservedQty - Number(tr.qty || 0));
      db.prepare("UPDATE inventory_items SET reserved_qty=?, updated_at=? WHERE id=?").run(nextReserved, t, item.id);
    }
    db.prepare("UPDATE item_transfers SET status=? WHERE id=?").run("canceled", tr.id);
    return { status: "canceled", toPlayerId: tr.to_player_id };
  });

  try {
    const result = tx();
    if (result.status === "expired") {
      return ok({ ok: true, status: "expired", expiredAt: result.expiredAt });
    }

    emitInventory(io, [sess.player_id]);
    emitTransfers(io, [sess.player_id, result.toPlayerId]);
    return ok({ ok: true, status: result.status, idempotent: !!result.idempotent });
  } catch (e) {
    if (e?.code) return error(e.status || 400, e.code, e.extra || null);
    throw e;
  }
}

export function listDmTransfers({ db, status }) {
  const rows = db.prepare(
    `SELECT tr.*,
            pf.display_name as fromName,
            pt.display_name as toName,
            i.name as itemName
     FROM item_transfers tr
     JOIN players pf ON pf.id = tr.from_player_id
     JOIN players pt ON pt.id = tr.to_player_id
     JOIN inventory_items i ON i.id = tr.item_id
     WHERE tr.status=?
     ORDER BY tr.created_at DESC`
  ).all(status);
  return ok({ items: rows.map(mapDmRow) });
}

export function processDmTransferCancel({ db, io, transferId, nowFn = now }) {
  const safeTransferId = Number(transferId);
  if (!safeTransferId) return error(400, "invalid_id");

  const tx = db.transaction(() => {
    const tr = db.prepare("SELECT * FROM item_transfers WHERE id=?").get(safeTransferId);
    if (!tr) transferError("transfer_not_found", 404);
    const t = nowFn();
    if (tr.status !== "pending") {
      if (tr.status === "canceled") return { status: tr.status, idempotent: true, fromPlayerId: tr.from_player_id, toPlayerId: tr.to_player_id };
      if (tr.status === "expired") return { status: "expired", expiredAt: tr.expires_at, fromPlayerId: tr.from_player_id, toPlayerId: tr.to_player_id };
      transferError("already_finalized", 400);
    }
    if (tr.expires_at <= t) {
      expireTransfer(db, tr, t);
      return { status: "expired", expiredAt: tr.expires_at, fromPlayerId: tr.from_player_id, toPlayerId: tr.to_player_id };
    }

    const item = db.prepare("SELECT * FROM inventory_items WHERE id=? AND player_id=?").get(tr.item_id, tr.from_player_id);
    if (item) {
      const reservedQty = Number(item.reserved_qty || 0);
      const nextReserved = Math.max(0, reservedQty - Number(tr.qty || 0));
      db.prepare("UPDATE inventory_items SET reserved_qty=?, updated_at=? WHERE id=?").run(nextReserved, t, item.id);
    }
    db.prepare("UPDATE item_transfers SET status=? WHERE id=?").run("canceled", tr.id);
    return { status: "canceled", fromPlayerId: tr.from_player_id, toPlayerId: tr.to_player_id };
  });

  try {
    const result = tx();
    if (result.status === "expired") {
      return ok({ ok: true, status: "expired", expiredAt: result.expiredAt });
    }

    emitInventory(io, [result.fromPlayerId, result.toPlayerId]);
    emitTransfers(io, [result.fromPlayerId, result.toPlayerId]);
    return ok({ ok: true, status: result.status, idempotent: !!result.idempotent });
  } catch (e) {
    if (e?.code) return error(e.status || 400, e.code, e.extra || null);
    throw e;
  }
}
