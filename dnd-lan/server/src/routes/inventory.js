import express from "express";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getParty } from "../db.js";
import { now } from "../util.js";
import { getInventoryLimitForPlayer } from "../inventoryLimit.js";
import { logEvent } from "../events.js";
import { getActiveSessionByToken, getPlayerTokenFromRequest } from "../sessionAuth.js";
import {
  INVENTORY_CONTAINER_BACKPACK,
  ensurePlayerLayoutSlots,
  findItemAtSlot,
  getNextInventorySlot
} from "./inventoryDomain.js";
import {
  listInventoryForPlayer,
  processDmInventoryBulkDelete,
  processDmInventoryBulkVisibility,
  processDmInventoryCreate,
  processDmInventoryDelete,
  processDmInventoryUpdate,
  processPlayerInventoryCreate,
  processPlayerInventoryDelete,
  processPlayerInventoryUpdate
} from "../inventory/services/inventoryCrudService.js";
import {
  processInventoryLayoutUpdate,
  processInventoryQuickEquip,
  processInventorySplit
} from "../inventory/services/inventoryLayoutService.js";
import {
  TRANSFER_MAX_QTY,
  TRANSFER_NOTE_MAX,
  TRANSFER_TTL_MS,
  expireTransfer,
  getInventoryTotalWeight,
  parseTransferQty,
  transferError
} from "../inventory/services/inventoryServiceUtils.js";

export const inventoryRouter = express.Router();

function authPlayer(req) {
  const token = getPlayerTokenFromRequest(req);
  if (!token) return null;
  return getActiveSessionByToken(token, { at: now() });
}

function ensureWritable(sess, res) {
  if (sess.impersonated && !sess.impersonated_write) {
    res.status(403).json({ error: "read_only_impersonation" });
    return false;
  }
  return true;
}

inventoryRouter.get("/mine", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  const result = listInventoryForPlayer({ db: getDb(), playerId: sess.player_id, includeWeightLimit: true });
  return res.status(result.status).json(result.body);
});

inventoryRouter.get("/player/:playerId", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  const result = listInventoryForPlayer({ db: getDb(), playerId: pid, includeWeightLimit: false });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/mine", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const result = processPlayerInventoryCreate({ db: getDb(), io: req.app.locals.io, sess, body: req.body });
  return res.status(result.status).json(result.body);
});

inventoryRouter.put("/mine/:id", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const itemId = Number(req.params.id);
  const result = processPlayerInventoryUpdate({ db: getDb(), io: req.app.locals.io, sess, itemId, body: req.body });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/mine/layout", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const result = processInventoryLayoutUpdate({ db: getDb(), io: req.app.locals.io, sess, body: req.body });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/mine/:id/split", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const result = processInventorySplit({
    db: getDb(),
    io: req.app.locals.io,
    sess,
    itemId: req.params.id,
    body: req.body
  });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/mine/:id/quick-equip", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const result = processInventoryQuickEquip({
    db: getDb(),
    io: req.app.locals.io,
    sess,
    itemId: req.params.id
  });
  return res.status(result.status).json(result.body);
});

inventoryRouter.delete("/mine/:id", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const itemId = Number(req.params.id);
  const result = processPlayerInventoryDelete({ db: getDb(), io: req.app.locals.io, sess, itemId });
  return res.status(result.status).json(result.body);
});

// DM edit any inventory
inventoryRouter.post("/dm/player/:playerId", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  if (!pid) return res.status(400).json({ error: "invalid_playerId" });
  const result = processDmInventoryCreate({ db: getDb(), io: req.app.locals.io, playerId: pid, body: req.body });
  return res.status(result.status).json(result.body);
});

// DM update any inventory item
inventoryRouter.put("/dm/player/:playerId/:id", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  const itemId = Number(req.params.id);
  if (!pid || !itemId) return res.status(400).json({ error: "invalid_id" });
  const result = processDmInventoryUpdate({
    db: getDb(),
    io: req.app.locals.io,
    playerId: pid,
    itemId,
    body: req.body,
    fallbackPartyId: getParty().id
  });
  return res.status(result.status).json(result.body);
});

// DM delete any inventory item
inventoryRouter.delete("/dm/player/:playerId/:id", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  const itemId = Number(req.params.id);
  if (!pid || !itemId) return res.status(400).json({ error: "invalid_id" });
  const result = processDmInventoryDelete({
    db: getDb(),
    io: req.app.locals.io,
    playerId: pid,
    itemId,
    fallbackPartyId: getParty().id
  });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/dm/player/:playerId/bulk-visibility", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  if (!pid) return res.status(400).json({ error: "invalid_playerId" });
  const result = processDmInventoryBulkVisibility({ db: getDb(), io: req.app.locals.io, playerId: pid, body: req.body });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/dm/player/:playerId/bulk-delete", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  if (!pid) return res.status(400).json({ error: "invalid_playerId" });
  const result = processDmInventoryBulkDelete({ db: getDb(), io: req.app.locals.io, playerId: pid, body: req.body });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/transfers", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const db = getDb();
  const b = req.body || {};

  const toPlayerId = Number(b.to_player_id);
  const itemId = Number(b.item_id);
  const qty = parseTransferQty(b.qty);
  const note = String(b.note || "").trim();

  if (!toPlayerId || !itemId) return res.status(400).json({ error: "invalid_id" });
  if (!Number.isFinite(qty) || qty < 1 || qty > TRANSFER_MAX_QTY) return res.status(400).json({ error: "invalid_qty" });
  if (note.length > TRANSFER_NOTE_MAX) return res.status(400).json({ error: "note_too_long" });
  if (toPlayerId === sess.player_id) return res.status(400).json({ error: "invalid_recipient" });

  const tx = db.transaction(() => {
    const recipient = db.prepare("SELECT id, party_id FROM players WHERE id=? AND banned=0").get(toPlayerId);
    if (!recipient || recipient.party_id !== sess.party_id) transferError("forbidden", 403);

    const item = db.prepare("SELECT * FROM inventory_items WHERE id=? AND player_id=?").get(itemId, sess.player_id);
    if (!item) transferError("not_found", 404);

    const reservedQty = Number(item.reserved_qty || 0);
    const totalQty = Number(item.qty || 0);
    const available = totalQty - reservedQty;
    if (qty > available) transferError("not_enough_qty", 400, { available });

    const t = now();
    const expiresAt = t + Math.max(60_000, TRANSFER_TTL_MS);

    db.prepare("UPDATE inventory_items SET reserved_qty=?, updated_at=? WHERE id=?")
      .run(reservedQty + qty, t, itemId);

    const id = db.prepare(
      "INSERT INTO item_transfers(from_player_id, to_player_id, item_id, qty, status, created_at, expires_at, note) VALUES(?,?,?,?,?,?,?,?)"
    ).run(sess.player_id, toPlayerId, itemId, qty, "pending", t, expiresAt, note || null).lastInsertRowid;

    return { id, itemName: item.name };
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
      message: `Передача предмета: ${out.itemName || itemId} → #${toPlayerId} (${qty} шт.)`,
      data: { fromPlayerId: sess.player_id, toPlayerId, itemId, qty },
      io: req.app.locals.io
    });

    req.app.locals.io?.to(`player:${sess.player_id}`).emit("inventory:updated");
    req.app.locals.io?.to(`player:${toPlayerId}`).emit("inventory:updated");
    req.app.locals.io?.to(`player:${sess.player_id}`).emit("transfers:updated");
    req.app.locals.io?.to(`player:${toPlayerId}`).emit("transfers:updated");
    req.app.locals.io?.to("dm").emit("inventory:updated");
    req.app.locals.io?.to("dm").emit("transfers:updated");

    return res.json({ ok: true, id: out.id });
  } catch (e) {
    if (e?.code) return res.status(e.status || 400).json({ error: e.code, ...(e.extra || {}) });
    throw e;
  }
});

inventoryRouter.get("/transfers/inbox", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  const db = getDb();
  const t = now();
  const rows = db.prepare(
    `
    SELECT tr.*,
           p.display_name as fromName,
           i.name as itemName,
           i.weight as itemWeight
    FROM item_transfers tr
    JOIN players p ON p.id = tr.from_player_id
    JOIN inventory_items i ON i.id = tr.item_id
    WHERE tr.to_player_id=? AND tr.status='pending' AND tr.expires_at>?
    ORDER BY tr.created_at DESC
  `
  ).all(sess.player_id, t);

  const items = rows.map((r) => ({
    id: r.id,
    fromPlayerId: r.from_player_id,
    fromName: r.fromName,
    itemId: r.item_id,
    itemName: r.itemName,
    itemWeight: Number(r.itemWeight || 0),
    qty: Number(r.qty || 0),
    status: r.status,
    note: r.note || "",
    createdAt: r.created_at,
    expiresAt: r.expires_at
  }));

  res.json({ items });
});

inventoryRouter.get("/transfers/outbox", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  const db = getDb();
  const t = now();
  const rows = db.prepare(
    `
    SELECT tr.*,
           p.display_name as toName,
           i.name as itemName,
           i.weight as itemWeight
    FROM item_transfers tr
    JOIN players p ON p.id = tr.to_player_id
    JOIN inventory_items i ON i.id = tr.item_id
    WHERE tr.from_player_id=? AND tr.status='pending' AND tr.expires_at>?
    ORDER BY tr.created_at DESC
  `
  ).all(sess.player_id, t);

  const items = rows.map((r) => ({
    id: r.id,
    toPlayerId: r.to_player_id,
    toName: r.toName,
    itemId: r.item_id,
    itemName: r.itemName,
    itemWeight: Number(r.itemWeight || 0),
    qty: Number(r.qty || 0),
    status: r.status,
    note: r.note || "",
    createdAt: r.created_at,
    expiresAt: r.expires_at
  }));

  res.json({ items });
});

inventoryRouter.post("/transfers/:id/accept", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const db = getDb();
  const transferId = Number(req.params.id);
  if (!transferId) return res.status(400).json({ error: "invalid_id" });

  const tx = db.transaction(() => {
    const tr = db.prepare("SELECT * FROM item_transfers WHERE id=?").get(transferId);
    if (!tr) transferError("transfer_not_found", 404);
    if (tr.to_player_id !== sess.player_id) transferError("forbidden", 403);
    const t = now();
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
      return res.json({ ok: true, status: "expired", expiredAt: result.expiredAt });
    }

    logEvent({
      partyId: sess.party_id,
      type: "inventory.transfer.accepted",
      actorRole: "player",
      actorPlayerId: sess.player_id,
      targetType: "inventory_item",
      targetId: transferId,
      message: `Принят предмет: ${result.itemName || transferId}`,
      data: { transferId, toPlayerId: sess.player_id, fromPlayerId: result.fromPlayerId },
      io: req.app.locals.io
    });

    req.app.locals.io?.to(`player:${sess.player_id}`).emit("inventory:updated");
    req.app.locals.io?.to(`player:${result.fromPlayerId}`).emit("inventory:updated");
    req.app.locals.io?.to(`player:${sess.player_id}`).emit("transfers:updated");
    req.app.locals.io?.to(`player:${result.fromPlayerId}`).emit("transfers:updated");
    req.app.locals.io?.to("dm").emit("inventory:updated");
    req.app.locals.io?.to("dm").emit("transfers:updated");

    return res.json({ ok: true, status: result.status, idempotent: !!result.idempotent });
  } catch (e) {
    if (e?.code) return res.status(e.status || 400).json({ error: e.code, ...(e.extra || {}) });
    throw e;
  }
});

inventoryRouter.post("/transfers/:id/reject", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const db = getDb();
  const transferId = Number(req.params.id);
  if (!transferId) return res.status(400).json({ error: "invalid_id" });

  const tx = db.transaction(() => {
    const tr = db.prepare("SELECT * FROM item_transfers WHERE id=?").get(transferId);
    if (!tr) transferError("transfer_not_found", 404);
    if (tr.to_player_id !== sess.player_id) transferError("forbidden", 403);
    const t = now();
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
      return res.json({ ok: true, status: "expired", expiredAt: result.expiredAt });
    }

    req.app.locals.io?.to(`player:${sess.player_id}`).emit("inventory:updated");
    req.app.locals.io?.to(`player:${result.fromPlayerId}`).emit("inventory:updated");
    req.app.locals.io?.to(`player:${sess.player_id}`).emit("transfers:updated");
    req.app.locals.io?.to(`player:${result.fromPlayerId}`).emit("transfers:updated");
    req.app.locals.io?.to("dm").emit("inventory:updated");
    req.app.locals.io?.to("dm").emit("transfers:updated");

    return res.json({ ok: true, status: result.status, idempotent: !!result.idempotent });
  } catch (e) {
    if (e?.code) return res.status(e.status || 400).json({ error: e.code, ...(e.extra || {}) });
    throw e;
  }
});

inventoryRouter.post("/transfers/:id/cancel", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const db = getDb();
  const transferId = Number(req.params.id);
  if (!transferId) return res.status(400).json({ error: "invalid_id" });

  const tx = db.transaction(() => {
    const tr = db.prepare("SELECT * FROM item_transfers WHERE id=?").get(transferId);
    if (!tr) transferError("transfer_not_found", 404);
    if (tr.from_player_id !== sess.player_id) transferError("forbidden", 403);
    const t = now();
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
      return res.json({ ok: true, status: "expired", expiredAt: result.expiredAt });
    }
    req.app.locals.io?.to(`player:${sess.player_id}`).emit("inventory:updated");
    req.app.locals.io?.to(`player:${sess.player_id}`).emit("transfers:updated");
    if (result.toPlayerId) req.app.locals.io?.to(`player:${result.toPlayerId}`).emit("transfers:updated");
    req.app.locals.io?.to("dm").emit("inventory:updated");
    req.app.locals.io?.to("dm").emit("transfers:updated");
    return res.json({ ok: true, status: result.status, idempotent: !!result.idempotent });
  } catch (e) {
    if (e?.code) return res.status(e.status || 400).json({ error: e.code, ...(e.extra || {}) });
    throw e;
  }
});

inventoryRouter.get("/transfers/dm", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const status = String(req.query?.status || "pending");
  const rows = db.prepare(
    `
    SELECT tr.*,
           pf.display_name as fromName,
           pt.display_name as toName,
           i.name as itemName
    FROM item_transfers tr
    JOIN players pf ON pf.id = tr.from_player_id
    JOIN players pt ON pt.id = tr.to_player_id
    JOIN inventory_items i ON i.id = tr.item_id
    WHERE tr.status=?
    ORDER BY tr.created_at DESC
  `
  ).all(status);

  const items = rows.map((r) => ({
    id: r.id,
    fromPlayerId: r.from_player_id,
    fromName: r.fromName,
    toPlayerId: r.to_player_id,
    toName: r.toName,
    itemId: r.item_id,
    itemName: r.itemName,
    qty: Number(r.qty || 0),
    status: r.status,
    note: r.note || "",
    createdAt: r.created_at,
    expiresAt: r.expires_at
  }));

  res.json({ items });
});

inventoryRouter.post("/transfers/:id/dm/cancel", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const transferId = Number(req.params.id);
  if (!transferId) return res.status(400).json({ error: "invalid_id" });

  const tx = db.transaction(() => {
    const tr = db.prepare("SELECT * FROM item_transfers WHERE id=?").get(transferId);
    if (!tr) transferError("transfer_not_found", 404);
    const t = now();
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
      return res.json({ ok: true, status: "expired", expiredAt: result.expiredAt });
    }
    req.app.locals.io?.to(`player:${result.fromPlayerId}`).emit("inventory:updated");
    req.app.locals.io?.to(`player:${result.toPlayerId}`).emit("inventory:updated");
    req.app.locals.io?.to(`player:${result.fromPlayerId}`).emit("transfers:updated");
    req.app.locals.io?.to(`player:${result.toPlayerId}`).emit("transfers:updated");
    req.app.locals.io?.to("dm").emit("inventory:updated");
    req.app.locals.io?.to("dm").emit("transfers:updated");
    return res.json({ ok: true, status: result.status, idempotent: !!result.idempotent });
  } catch (e) {
    if (e?.code) return res.status(e.status || 400).json({ error: e.code, ...(e.extra || {}) });
    throw e;
  }
});
