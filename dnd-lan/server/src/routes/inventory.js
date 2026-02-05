import express from "express";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getParty } from "../db.js";
import { now, jsonParse } from "../util.js";
import { getInventoryLimitForPlayer } from "../inventoryLimit.js";
import { logEvent } from "../events.js";

export const inventoryRouter = express.Router();

const TRANSFER_MAX_QTY = 9999;
const TRANSFER_NOTE_MAX = 140;
const TRANSFER_TTL_MS = Number(process.env.INVENTORY_TRANSFER_TTL_MS || 3 * 24 * 60 * 60 * 1000);

function toFiniteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function authPlayer(req) {
  const token = req.header("x-player-token");
  if (!token) return null;
  const db = getDb();
  const sess = db.prepare("SELECT * FROM sessions WHERE token=? AND revoked=0 AND expires_at>?").get(String(token), now());
  if (!sess) return null;
  return sess;
}

function ensureWritable(sess, res) {
  if (sess.impersonated && !sess.impersonated_write) {
    res.status(403).json({ error: "read_only_impersonation" });
    return false;
  }
  return true;
}

function getInventoryTotalWeight(db, playerId, excludeItemId = null) {
  const row = excludeItemId
    ? db.prepare("SELECT SUM(weight * qty) AS total FROM inventory_items WHERE player_id=? AND id<>?").get(playerId, excludeItemId)
    : db.prepare("SELECT SUM(weight * qty) AS total FROM inventory_items WHERE player_id=?").get(playerId);
  const total = Number(row?.total ?? 0);
  return Number.isFinite(total) ? total : 0;
}

function checkWeightLimit(db, playerId, nextQty, nextWeight, res, excludeItemId = null, currentTotal = null, limitOverride = null) {
  const raw = Number.isFinite(limitOverride) ? Number(limitOverride) : Number(getInventoryLimitForPlayer(db, playerId).limit || 0);
  if (!Number.isFinite(raw) || raw <= 0) return true;
  const base = getInventoryTotalWeight(db, playerId, excludeItemId);
  const projected = base + (Number(nextQty || 0) * Number(nextWeight || 0));
  const totalNow = Number.isFinite(currentTotal)
    ? Number(currentTotal)
    : (excludeItemId == null ? base : getInventoryTotalWeight(db, playerId));
  if (projected > raw && projected > totalNow) {
    res.status(400).json({ error: "weight_limit_exceeded", limit: raw, projected });
    return false;
  }
  return true;
}

function transferError(code, status = 400, extra = null) {
  const err = new Error(code);
  err.code = code;
  err.status = status;
  if (extra) err.extra = extra;
  throw err;
}

function parseTransferQty(value) {
  const qty = Math.floor(toFiniteNumber(value, NaN));
  if (!Number.isFinite(qty)) return NaN;
  return qty;
}

inventoryRouter.get("/mine", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  const db = getDb();
  const items = db.prepare("SELECT * FROM inventory_items WHERE player_id=? ORDER BY id DESC").all(sess.player_id)
    .map((r) => ({
      ...r,
      imageUrl: r.image_url || "",
      tags: jsonParse(r.tags, []),
      reservedQty: Number(r.reserved_qty || 0)
    }));
  const limitInfo = getInventoryLimitForPlayer(db, sess.player_id);
  res.json({ items, weightLimit: limitInfo.limit, weightLimitBase: limitInfo.base, weightLimitRace: limitInfo.race, weightLimitBonus: limitInfo.bonus });
});

inventoryRouter.get("/player/:playerId", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  const db = getDb();
  const items = db.prepare("SELECT * FROM inventory_items WHERE player_id=? ORDER BY id DESC").all(pid)
    .map((r) => ({ ...r, imageUrl: r.image_url || "", tags: jsonParse(r.tags, []), reservedQty: Number(r.reserved_qty || 0) }));
  res.json({ items });
});

inventoryRouter.post("/mine", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const db = getDb();
  const b = req.body || {};
  const name = String(b.name || "").trim();
  if (!name) return res.status(400).json({ error: "name_required" });

  const qty = Math.max(1, toFiniteNumber(b.qty ?? 1, 1));
  const weight = Math.max(0, toFiniteNumber(b.weight ?? 0, 0));
  const rarity = String(b.rarity || "common");
  const visibility = (b.visibility === "hidden") ? "hidden" : "public";
  const tags = Array.isArray(b.tags) ? b.tags.map(String) : [];
  const desc = String(b.description || "");
  const imageUrl = String(b.imageUrl || b.image_url || "");
  const limitInfo = getInventoryLimitForPlayer(db, sess.player_id);
  if (!checkWeightLimit(db, sess.player_id, qty, weight, res, null, null, limitInfo.limit)) return;

  const t = now();
  const id = db.prepare(
    "INSERT INTO inventory_items(player_id, name, description, image_url, qty, weight, rarity, tags, visibility, updated_at, updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)"
  ).run(
    sess.player_id,
    name,
    desc,
    imageUrl || null,
    qty,
    weight,
    rarity,
    JSON.stringify(tags),
    visibility,
    t,
    sess.impersonated ? "dm" : "player"
  ).lastInsertRowid;

  logEvent({
    partyId: sess.party_id,
    type: "inventory.created",
    actorRole: sess.impersonated ? "dm" : "player",
    actorPlayerId: sess.player_id,
    actorName: sess.impersonated ? "DM (impersonation)" : null,
    targetType: "inventory_item",
    targetId: Number(id),
    message: `Добавлен предмет: ${name}`,
    data: { playerId: sess.player_id, visibility, qty },
    io: req.app.locals.io
  });

  req.app.locals.io?.to(`player:${sess.player_id}`).emit("inventory:updated");
  req.app.locals.io?.to("dm").emit("inventory:updated");
  res.json({ ok: true, id });
});

inventoryRouter.put("/mine/:id", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const db = getDb();
  const itemId = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM inventory_items WHERE id=? AND player_id=?").get(itemId, sess.player_id);
  if (!existing) return res.status(404).json({ error: "not_found" });

  const b = req.body || {};
  const name = String(b.name ?? existing.name).trim();
  if (!name) return res.status(400).json({ error: "name_required" });

  const qty = Math.max(1, toFiniteNumber(b.qty ?? existing.qty, existing.qty ?? 1));
  const weight = Math.max(0, toFiniteNumber(b.weight ?? existing.weight, existing.weight ?? 0));
  const rarity = String(b.rarity ?? existing.rarity);
  const visibility = (b.visibility ?? existing.visibility) === "hidden" ? "hidden" : "public";
  const tags = Array.isArray(b.tags) ? b.tags.map(String) : jsonParse(existing.tags, []);
  const desc = String(b.description ?? existing.description ?? "");
  const imageUrl = String(b.imageUrl ?? b.image_url ?? existing.image_url ?? "");
  const reservedQty = Number(existing.reserved_qty || 0);
  if (qty < reservedQty) return res.status(400).json({ error: "reserved_qty_exceeded" });
  const limitInfo = getInventoryLimitForPlayer(db, sess.player_id);
  if (!checkWeightLimit(db, sess.player_id, qty, weight, res, itemId, null, limitInfo.limit)) return;

  db.prepare("UPDATE inventory_items SET name=?, description=?, image_url=?, qty=?, weight=?, rarity=?, tags=?, visibility=?, updated_at=?, updated_by=? WHERE id=?")
    .run(name, desc, imageUrl || null, qty, weight, rarity, JSON.stringify(tags), visibility, now(), sess.impersonated ? "dm" : "player", itemId);

  logEvent({
    partyId: sess.party_id,
    type: "inventory.updated",
    actorRole: sess.impersonated ? "dm" : "player",
    actorPlayerId: sess.player_id,
    actorName: sess.impersonated ? "DM (impersonation)" : null,
    targetType: "inventory_item",
    targetId: Number(itemId),
    message: `Изменён предмет: ${name}`,
    data: { playerId: sess.player_id, visibility, qty },
    io: req.app.locals.io
  });

  req.app.locals.io?.to(`player:${sess.player_id}`).emit("inventory:updated");
  req.app.locals.io?.to("dm").emit("inventory:updated");
  res.json({ ok: true });
});

inventoryRouter.delete("/mine/:id", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const db = getDb();
  const itemId = Number(req.params.id);
  const row = db.prepare("SELECT name, reserved_qty FROM inventory_items WHERE id=? AND player_id=?").get(itemId, sess.player_id);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (Number(row.reserved_qty || 0) > 0) return res.status(400).json({ error: "transfer_pending" });
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
    io: req.app.locals.io
  });

  req.app.locals.io?.to(`player:${sess.player_id}`).emit("inventory:updated");
  req.app.locals.io?.to("dm").emit("inventory:updated");
  res.json({ ok: true });
});

// DM edit any inventory
inventoryRouter.post("/dm/player/:playerId", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  const db = getDb();
  const b = req.body || {};
  const name = String(b.name || "").trim();
  if (!name) return res.status(400).json({ error: "name_required" });

  const qty = Math.max(1, toFiniteNumber(b.qty ?? 1, 1));
  const weight = Math.max(0, toFiniteNumber(b.weight ?? 0, 0));
  const rarity = String(b.rarity || "common");
  const visibility = (b.visibility === "hidden") ? "hidden" : "public";
  const tags = Array.isArray(b.tags) ? b.tags.map(String) : [];
  const desc = String(b.description || "");
  const imageUrl = String(b.imageUrl || b.image_url || "");
  const limitInfo = getInventoryLimitForPlayer(db, pid);
  if (!checkWeightLimit(db, pid, qty, weight, res, null, null, limitInfo.limit)) return;

  const ins2 = db.prepare(
    "INSERT INTO inventory_items(player_id, name, description, image_url, qty, weight, rarity, tags, visibility, updated_at, updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)"
  ).run(pid, name, desc, imageUrl || null, qty, weight, rarity, JSON.stringify(tags), visibility, now(), "dm");

  const p = db.prepare("SELECT party_id FROM players WHERE id=?").get(pid);
  logEvent({
    partyId: p?.party_id ?? getParty().id,
    type: "inventory.granted",
    actorRole: "dm",
    actorName: "DM",
    targetType: "inventory_item",
    targetId: Number(ins2.lastInsertRowid),
    message: `DM выдал предмет "${name}" игроку #${pid}`,
    data: { playerId: pid, visibility, qty },
    io: req.app.locals.io
  });

  req.app.locals.io?.to(`player:${pid}`).emit("inventory:updated");
  req.app.locals.io?.to("dm").emit("inventory:updated");
  res.json({ ok: true });
});

// DM update any inventory item
inventoryRouter.put("/dm/player/:playerId/:id", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  const itemId = Number(req.params.id);
  if (!pid || !itemId) return res.status(400).json({ error: "invalid_id" });

  const db = getDb();
  const existing = db.prepare("SELECT * FROM inventory_items WHERE id=? AND player_id=?").get(itemId, pid);
  if (!existing) return res.status(404).json({ error: "not_found" });

  const b = req.body || {};
  const name = String(b.name ?? existing.name).trim();
  if (!name) return res.status(400).json({ error: "name_required" });

  const qty = Math.max(1, toFiniteNumber(b.qty ?? existing.qty, existing.qty ?? 1));
  const weight = Math.max(0, toFiniteNumber(b.weight ?? existing.weight, existing.weight ?? 0));
  const rarity = String(b.rarity ?? existing.rarity);
  const visibility = (b.visibility ?? existing.visibility) === "hidden" ? "hidden" : "public";
  const tags = Array.isArray(b.tags) ? b.tags.map(String) : jsonParse(existing.tags, []);
  const desc = String(b.description ?? existing.description ?? "");
  const imageUrl = String(b.imageUrl ?? b.image_url ?? existing.image_url ?? "");
  const reservedQty = Number(existing.reserved_qty || 0);
  if (qty < reservedQty) return res.status(400).json({ error: "reserved_qty_exceeded" });
  const limitInfo = getInventoryLimitForPlayer(db, pid);
  if (!checkWeightLimit(db, pid, qty, weight, res, itemId, null, limitInfo.limit)) return;

  db.prepare("UPDATE inventory_items SET name=?, description=?, image_url=?, qty=?, weight=?, rarity=?, tags=?, visibility=?, updated_at=?, updated_by=? WHERE id=?")
    .run(name, desc, imageUrl || null, qty, weight, rarity, JSON.stringify(tags), visibility, now(), "dm", itemId);

  const p = db.prepare("SELECT party_id FROM players WHERE id=?").get(pid);
  logEvent({
    partyId: p?.party_id ?? getParty().id,
    type: "inventory.updated",
    actorRole: "dm",
    actorName: "DM",
    targetType: "inventory_item",
    targetId: Number(itemId),
    message: `DM изменил предмет "${name}" игроку #${pid}`,
    data: { playerId: pid, visibility, qty },
    io: req.app.locals.io
  });

  req.app.locals.io?.to(`player:${pid}`).emit("inventory:updated");
  req.app.locals.io?.to("dm").emit("inventory:updated");
  res.json({ ok: true });
});

// DM delete any inventory item
inventoryRouter.delete("/dm/player/:playerId/:id", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  const itemId = Number(req.params.id);
  if (!pid || !itemId) return res.status(400).json({ error: "invalid_id" });

  const db = getDb();
  const row = db.prepare("SELECT name, reserved_qty FROM inventory_items WHERE id=? AND player_id=?").get(itemId, pid);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (Number(row.reserved_qty || 0) > 0) return res.status(400).json({ error: "transfer_pending" });

  db.prepare("DELETE FROM inventory_items WHERE id=? AND player_id=?").run(itemId, pid);

  const p = db.prepare("SELECT party_id FROM players WHERE id=?").get(pid);
  logEvent({
    partyId: p?.party_id ?? getParty().id,
    type: "inventory.deleted",
    actorRole: "dm",
    actorName: "DM",
    targetType: "inventory_item",
    targetId: Number(itemId),
    message: `DM удалил предмет "${row?.name || itemId}" у игрока #${pid}`,
    data: { playerId: pid },
    io: req.app.locals.io
  });

  req.app.locals.io?.to(`player:${pid}`).emit("inventory:updated");
  req.app.locals.io?.to("dm").emit("inventory:updated");
  res.json({ ok: true });
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
    req.app.locals.io?.to(`player:${toPlayerId}`).emit("transfers:updated");
    req.app.locals.io?.to("dm").emit("inventory:updated");

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
    if (tr.status !== "pending") {
      if (tr.status === "accepted") return { status: tr.status, idempotent: true };
      transferError("already_finalized", 400);
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

    const t = now();
    const newReserved = reservedQty - tr.qty;
    const newQty = totalQty - tr.qty;
    if (newQty <= 0) {
      db.prepare("DELETE FROM inventory_items WHERE id=?").run(item.id);
    } else {
      db.prepare("UPDATE inventory_items SET qty=?, reserved_qty=?, updated_at=? WHERE id=?")
        .run(newQty, Math.max(0, newReserved), t, item.id);
    }

    db.prepare(
      "INSERT INTO inventory_items(player_id, name, description, image_url, qty, weight, rarity, tags, visibility, updated_at, updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)"
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
      t,
      "transfer"
    );

    db.prepare("UPDATE item_transfers SET status=? WHERE id=?").run("accepted", tr.id);

    return { status: "accepted", fromPlayerId: tr.from_player_id, itemName: item.name };
  });

  try {
    const result = tx();

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
    req.app.locals.io?.to("dm").emit("inventory:updated");

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
    if (tr.status !== "pending") {
      if (tr.status === "rejected") return { status: tr.status, idempotent: true, fromPlayerId: tr.from_player_id };
      transferError("already_finalized", 400);
    }

    const item = db.prepare("SELECT * FROM inventory_items WHERE id=? AND player_id=?").get(tr.item_id, tr.from_player_id);
    if (item) {
      const reservedQty = Number(item.reserved_qty || 0);
      const nextReserved = Math.max(0, reservedQty - Number(tr.qty || 0));
      db.prepare("UPDATE inventory_items SET reserved_qty=?, updated_at=? WHERE id=?").run(nextReserved, now(), item.id);
    }

    db.prepare("UPDATE item_transfers SET status=? WHERE id=?").run("rejected", tr.id);
    return { status: "rejected", fromPlayerId: tr.from_player_id };
  });

  try {
    const result = tx();

    req.app.locals.io?.to(`player:${sess.player_id}`).emit("inventory:updated");
    req.app.locals.io?.to(`player:${result.fromPlayerId}`).emit("inventory:updated");
    req.app.locals.io?.to(`player:${sess.player_id}`).emit("transfers:updated");
    req.app.locals.io?.to("dm").emit("inventory:updated");

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
    if (tr.status !== "pending") {
      if (tr.status === "canceled") return { status: tr.status, idempotent: true };
      transferError("already_finalized", 400);
    }

    const item = db.prepare("SELECT * FROM inventory_items WHERE id=? AND player_id=?").get(tr.item_id, tr.from_player_id);
    if (item) {
      const reservedQty = Number(item.reserved_qty || 0);
      const nextReserved = Math.max(0, reservedQty - Number(tr.qty || 0));
      db.prepare("UPDATE inventory_items SET reserved_qty=?, updated_at=? WHERE id=?").run(nextReserved, now(), item.id);
    }

    db.prepare("UPDATE item_transfers SET status=? WHERE id=?").run("canceled", tr.id);
    return { status: "canceled" };
  });

  try {
    const result = tx();
    req.app.locals.io?.to(`player:${sess.player_id}`).emit("inventory:updated");
    req.app.locals.io?.to("dm").emit("inventory:updated");
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
    if (tr.status !== "pending") {
      if (tr.status === "canceled") return { status: tr.status, idempotent: true, fromPlayerId: tr.from_player_id, toPlayerId: tr.to_player_id };
      transferError("already_finalized", 400);
    }

    const item = db.prepare("SELECT * FROM inventory_items WHERE id=? AND player_id=?").get(tr.item_id, tr.from_player_id);
    if (item) {
      const reservedQty = Number(item.reserved_qty || 0);
      const nextReserved = Math.max(0, reservedQty - Number(tr.qty || 0));
      db.prepare("UPDATE inventory_items SET reserved_qty=?, updated_at=? WHERE id=?").run(nextReserved, now(), item.id);
    }

    db.prepare("UPDATE item_transfers SET status=? WHERE id=?").run("canceled", tr.id);
    return { status: "canceled", fromPlayerId: tr.from_player_id, toPlayerId: tr.to_player_id };
  });

  try {
    const result = tx();
    req.app.locals.io?.to(`player:${result.fromPlayerId}`).emit("inventory:updated");
    req.app.locals.io?.to(`player:${result.toPlayerId}`).emit("inventory:updated");
    req.app.locals.io?.to("dm").emit("inventory:updated");
    return res.json({ ok: true, status: result.status, idempotent: !!result.idempotent });
  } catch (e) {
    if (e?.code) return res.status(e.status || 400).json({ error: e.code, ...(e.extra || {}) });
    throw e;
  }
});
