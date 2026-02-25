import express from "express";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getParty } from "../db.js";
import { now, jsonParse } from "../util.js";
import { getInventoryLimitForPlayer } from "../inventoryLimit.js";
import { logEvent } from "../events.js";
import { getActiveSessionByToken, getPlayerTokenFromRequest } from "../sessionAuth.js";

export const inventoryRouter = express.Router();

const TRANSFER_MAX_QTY = 9999;
const TRANSFER_NOTE_MAX = 140;
const TRANSFER_TTL_MS = Number(process.env.INVENTORY_TRANSFER_TTL_MS || 3 * 24 * 60 * 60 * 1000);
const INVENTORY_CONTAINER_BACKPACK = "backpack";
const INVENTORY_CONTAINER_HOTBAR = "hotbar";
const INVENTORY_CONTAINER_EQUIPMENT = "equipment";
const INVENTORY_LAYOUT = {
  [INVENTORY_CONTAINER_BACKPACK]: { cols: 6, rows: 100 },
  [INVENTORY_CONTAINER_HOTBAR]: { cols: 6, rows: 1 },
  [INVENTORY_CONTAINER_EQUIPMENT]: { cols: 4, rows: 1 }
};
const INVENTORY_SLOT_MAX = 99;

function toFiniteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

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

function expireTransfer(db, tr, t = now()) {
  const item = db.prepare("SELECT id, reserved_qty FROM inventory_items WHERE id=? AND player_id=?")
    .get(tr.item_id, tr.from_player_id);
  if (item) {
    const reservedQty = Number(item.reserved_qty || 0);
    const nextReserved = Math.max(0, reservedQty - Number(tr.qty || 0));
    db.prepare("UPDATE inventory_items SET reserved_qty=?, updated_at=? WHERE id=?").run(nextReserved, t, item.id);
  }
  db.prepare("UPDATE item_transfers SET status='expired' WHERE id=?").run(tr.id);
}

function parseTransferQty(value) {
  const qty = Math.floor(toFiniteNumber(value, NaN));
  if (!Number.isFinite(qty)) return NaN;
  return qty;
}

function normalizeIdList(input, max = 300) {
  if (!Array.isArray(input)) return [];
  const out = [];
  const seen = new Set();
  for (const value of input) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

function normalizeInventoryContainer(value) {
  const key = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(INVENTORY_LAYOUT, key)
    ? key
    : INVENTORY_CONTAINER_BACKPACK;
}

function normalizeSlotCoord(value) {
  const n = Math.floor(toFiniteNumber(value, NaN));
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > INVENTORY_SLOT_MAX) return null;
  return n;
}

function isValidSlot(container, slotX, slotY) {
  const spec = INVENTORY_LAYOUT[container];
  return !!spec
    && Number.isInteger(slotX)
    && Number.isInteger(slotY)
    && slotX >= 0
    && slotX < spec.cols
    && slotY >= 0
    && slotY < spec.rows;
}

function makeSlotKey(container, slotX, slotY) {
  return `${container}:${slotX}:${slotY}`;
}

function allocateNextSlot(occupied, container = INVENTORY_CONTAINER_BACKPACK) {
  const normalizedContainer = normalizeInventoryContainer(container);
  const spec = INVENTORY_LAYOUT[normalizedContainer] || INVENTORY_LAYOUT[INVENTORY_CONTAINER_BACKPACK];
  for (let y = 0; y < spec.rows; y += 1) {
    for (let x = 0; x < spec.cols; x += 1) {
      const key = makeSlotKey(normalizedContainer, x, y);
      if (!occupied.has(key)) return { container: normalizedContainer, slotX: x, slotY: y };
    }
  }
  return { container: normalizedContainer, slotX: 0, slotY: 0 };
}

function getRequestedSlot(body) {
  const hasSlotX = body && (Object.prototype.hasOwnProperty.call(body, "slotX") || Object.prototype.hasOwnProperty.call(body, "slot_x"));
  const hasSlotY = body && (Object.prototype.hasOwnProperty.call(body, "slotY") || Object.prototype.hasOwnProperty.call(body, "slot_y"));
  if (!hasSlotX && !hasSlotY) return null;
  if (!hasSlotX || !hasSlotY) return { error: "invalid_slot" };
  const container = normalizeInventoryContainer(body?.container ?? body?.inv_container);
  const slotX = normalizeSlotCoord(body?.slotX ?? body?.slot_x);
  const slotY = normalizeSlotCoord(body?.slotY ?? body?.slot_y);
  if (!isValidSlot(container, slotX, slotY)) return { error: "invalid_slot" };
  return { container, slotX, slotY };
}

function findItemAtSlot(db, playerId, container, slotX, slotY, excludeItemId = null) {
  const normalizedContainer = normalizeInventoryContainer(container);
  if (!isValidSlot(normalizedContainer, slotX, slotY)) return null;
  if (excludeItemId) {
    return db.prepare(
      "SELECT id FROM inventory_items WHERE player_id=? AND inv_container=? AND slot_x=? AND slot_y=? AND id<>? LIMIT 1"
    ).get(playerId, normalizedContainer, slotX, slotY, excludeItemId);
  }
  return db.prepare(
    "SELECT id FROM inventory_items WHERE player_id=? AND inv_container=? AND slot_x=? AND slot_y=? LIMIT 1"
  ).get(playerId, normalizedContainer, slotX, slotY);
}

function collectItemTokens(item) {
  const tags = Array.isArray(item?.tags)
    ? item.tags
    : jsonParse(item?.tags, []);
  const all = [
    item?.name,
    item?.description,
    item?.rarity,
    ...(Array.isArray(tags) ? tags : [])
  ].filter(Boolean);
  return all.map((part) => String(part).toLowerCase());
}

function allowedEquipmentSlotsForItem(item) {
  const text = collectItemTokens(item).join(" ");
  const has = (list) => list.some((word) => text.includes(word));
  if (has(["armor", "armour", "брон", "доспех", "кольч", "латы", "helmet", "helm", "шлем"])) return [2];
  if (has(["shield", "щит", "buckler"])) return [1];
  if (has(["sword", "blade", "axe", "bow", "spear", "staff", "wand", "weapon", "меч", "топор", "лук", "копь", "посох", "жезл", "оруж"])) return [0];
  if (has(["ring", "amulet", "jewel", "accessory", "кольц", "амулет", "ожерель", "талисман", "кулон"])) return [3];
  return [];
}

function isPlacementAllowedForItem(item, container, slotX) {
  const normalizedContainer = normalizeInventoryContainer(container);
  if (normalizedContainer !== INVENTORY_CONTAINER_EQUIPMENT) return true;
  const allowed = allowedEquipmentSlotsForItem(item);
  if (!allowed.length) return false;
  return allowed.includes(Number(slotX));
}

function ensurePlayerLayoutSlots(db, playerId) {
  const rows = db.prepare(
    "SELECT id, inv_container, slot_x, slot_y FROM inventory_items WHERE player_id=? ORDER BY id DESC"
  ).all(playerId);
  const occupied = new Set();
  const updates = [];

  for (const row of rows) {
    const container = normalizeInventoryContainer(row.inv_container);
    const slotX = normalizeSlotCoord(row.slot_x);
    const slotY = normalizeSlotCoord(row.slot_y);
    const valid = isValidSlot(container, slotX, slotY);
    const key = valid ? makeSlotKey(container, slotX, slotY) : "";
    if (valid && !occupied.has(key)) {
      occupied.add(key);
      if (container !== row.inv_container) {
        updates.push({ id: Number(row.id), container, slotX, slotY });
      }
      continue;
    }
    const next = allocateNextSlot(occupied, container);
    occupied.add(makeSlotKey(next.container, next.slotX, next.slotY));
    updates.push({ id: Number(row.id), ...next });
  }

  if (!updates.length) return;
  const t = now();
  const stmt = db.prepare(
    "UPDATE inventory_items SET inv_container=?, slot_x=?, slot_y=?, updated_at=? WHERE id=?"
  );
  const tx = db.transaction(() => {
    for (const move of updates) {
      stmt.run(move.container, move.slotX, move.slotY, t, move.id);
    }
  });
  tx();
}

function getNextInventorySlot(db, playerId, container = INVENTORY_CONTAINER_BACKPACK) {
  const rows = db.prepare(
    "SELECT inv_container, slot_x, slot_y FROM inventory_items WHERE player_id=?"
  ).all(playerId);
  const occupied = new Set();
  for (const row of rows) {
    const c = normalizeInventoryContainer(row.inv_container);
    const x = normalizeSlotCoord(row.slot_x);
    const y = normalizeSlotCoord(row.slot_y);
    if (!isValidSlot(c, x, y)) continue;
    occupied.add(makeSlotKey(c, x, y));
  }
  return allocateNextSlot(occupied, normalizeInventoryContainer(container));
}

function mapInventoryRow(row) {
  return {
    ...row,
    imageUrl: row.image_url || "",
    tags: jsonParse(row.tags, []),
    reservedQty: Number(row.reserved_qty || 0),
    container: normalizeInventoryContainer(row.inv_container),
    slotX: normalizeSlotCoord(row.slot_x),
    slotY: normalizeSlotCoord(row.slot_y)
  };
}

function parseLayoutMoves(input, max = 300) {
  if (!Array.isArray(input)) return { ok: false, error: "invalid_moves" };
  if (!input.length) return { ok: false, error: "empty_moves" };
  const out = [];
  const seenIds = new Set();
  for (const raw of input) {
    const id = Number(raw?.id);
    const container = normalizeInventoryContainer(raw?.container ?? raw?.inv_container);
    const slotX = normalizeSlotCoord(raw?.slotX ?? raw?.slot_x);
    const slotY = normalizeSlotCoord(raw?.slotY ?? raw?.slot_y);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "invalid_id" };
    if (seenIds.has(id)) return { ok: false, error: "duplicate_item_id" };
    if (!isValidSlot(container, slotX, slotY)) return { ok: false, error: "invalid_slot" };
    seenIds.add(id);
    out.push({ id, container, slotX, slotY });
    if (out.length > max) return { ok: false, error: "too_many_moves" };
  }
  return { ok: true, moves: out };
}

inventoryRouter.get("/mine", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  const db = getDb();
  ensurePlayerLayoutSlots(db, sess.player_id);
  const items = db.prepare(
    "SELECT * FROM inventory_items WHERE player_id=? ORDER BY inv_container ASC, slot_y ASC, slot_x ASC, id DESC"
  ).all(sess.player_id).map(mapInventoryRow);
  const limitInfo = getInventoryLimitForPlayer(db, sess.player_id);
  res.json({ items, weightLimit: limitInfo.limit, weightLimitBase: limitInfo.base, weightLimitRace: limitInfo.race, weightLimitBonus: limitInfo.bonus });
});

inventoryRouter.get("/player/:playerId", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  const db = getDb();
  ensurePlayerLayoutSlots(db, pid);
  const items = db.prepare(
    "SELECT * FROM inventory_items WHERE player_id=? ORDER BY inv_container ASC, slot_y ASC, slot_x ASC, id DESC"
  ).all(pid).map(mapInventoryRow);
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
  ensurePlayerLayoutSlots(db, sess.player_id);
  const requestedContainer = normalizeInventoryContainer(b.container ?? b.inv_container);
  const requestedSlot = getRequestedSlot(b);
  if (requestedSlot?.error) return res.status(400).json({ error: requestedSlot.error });
  const slot = requestedSlot || getNextInventorySlot(db, sess.player_id, requestedContainer);
  const occupiedBy = findItemAtSlot(db, sess.player_id, slot.container, slot.slotX, slot.slotY);
  if (occupiedBy) return res.status(409).json({ error: "slot_occupied", itemId: Number(occupiedBy.id) });
  if (!isPlacementAllowedForItem({ name, description: desc, rarity, tags }, slot.container, slot.slotX)) {
    return res.status(400).json({ error: "invalid_equipment_slot" });
  }

  const t = now();
  const id = db.prepare(
    "INSERT INTO inventory_items(player_id, name, description, image_url, qty, weight, rarity, tags, visibility, inv_container, slot_x, slot_y, updated_at, updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
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
    slot.container,
    slot.slotX,
    slot.slotY,
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
  ensurePlayerLayoutSlots(db, sess.player_id);
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
  const container = normalizeInventoryContainer(b.container ?? b.inv_container ?? existing.inv_container);
  const slotX = normalizeSlotCoord(b.slotX ?? b.slot_x ?? existing.slot_x);
  const slotY = normalizeSlotCoord(b.slotY ?? b.slot_y ?? existing.slot_y);
  if (!isValidSlot(container, slotX, slotY)) return res.status(400).json({ error: "invalid_slot" });
  const occupiedBy = findItemAtSlot(db, sess.player_id, container, slotX, slotY, itemId);
  if (occupiedBy) return res.status(409).json({ error: "slot_occupied", itemId: Number(occupiedBy.id) });
  if (!isPlacementAllowedForItem({ name, description: desc, rarity, tags }, container, slotX)) {
    return res.status(400).json({ error: "invalid_equipment_slot" });
  }
  const reservedQty = Number(existing.reserved_qty || 0);
  if (qty < reservedQty) return res.status(400).json({ error: "reserved_qty_exceeded" });
  const limitInfo = getInventoryLimitForPlayer(db, sess.player_id);
  if (!checkWeightLimit(db, sess.player_id, qty, weight, res, itemId, null, limitInfo.limit)) return;

  db.prepare(
    "UPDATE inventory_items SET name=?, description=?, image_url=?, qty=?, weight=?, rarity=?, tags=?, visibility=?, inv_container=?, slot_x=?, slot_y=?, updated_at=?, updated_by=? WHERE id=?"
  ).run(
    name,
    desc,
    imageUrl || null,
    qty,
    weight,
    rarity,
    JSON.stringify(tags),
    visibility,
    container,
    slotX,
    slotY,
    now(),
    sess.impersonated ? "dm" : "player",
    itemId
  );

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

inventoryRouter.post("/mine/layout", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const parsed = parseLayoutMoves(req.body?.moves, 500);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const db = getDb();
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
  if (rows.length !== moves.length) return res.status(404).json({ error: "not_found" });

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
    if (!item) return res.status(404).json({ error: "not_found" });
    if (!isPlacementAllowedForItem(item, move.container, move.slotX)) {
      return res.status(400).json({ error: "invalid_equipment_slot", itemId: move.id });
    }
    const key = makeSlotKey(move.container, move.slotX, move.slotY);
    if (occupied.has(key)) return res.status(409).json({ error: "slot_occupied", itemId: occupied.get(key) });
    occupied.set(key, move.id);
  }

  const t = now();
  const stmt = db.prepare(
    "UPDATE inventory_items SET inv_container=?, slot_x=?, slot_y=?, updated_at=?, updated_by=? WHERE id=? AND player_id=?"
  );
  const tx = db.transaction(() => {
    for (const move of moves) {
      const existing = byId.get(move.id);
      if (!existing) continue;
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

  req.app.locals.io?.to(`player:${sess.player_id}`).emit("inventory:updated");
  req.app.locals.io?.to("dm").emit("inventory:updated");
  res.json({ ok: true, updated: moves.length });
});

inventoryRouter.post("/mine/:id/split", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const itemId = Number(req.params.id);
  if (!itemId) return res.status(400).json({ error: "invalid_id" });

  const qty = Math.floor(toFiniteNumber(req.body?.qty, NaN));
  if (!Number.isFinite(qty) || qty < 1) return res.status(400).json({ error: "invalid_qty" });
  const db = getDb();
  const requestedSlot = getRequestedSlot(req.body || {});
  if (requestedSlot?.error) return res.status(400).json({ error: requestedSlot.error });
  const preferredContainer = normalizeInventoryContainer(req.body?.container ?? req.body?.inv_container);

  ensurePlayerLayoutSlots(db, sess.player_id);
  const tx = db.transaction(() => {
    const existing = db.prepare("SELECT * FROM inventory_items WHERE id=? AND player_id=?").get(itemId, sess.player_id);
    if (!existing) transferError("not_found", 404);
    const totalQty = Number(existing.qty || 0);
    const reservedQty = Number(existing.reserved_qty || 0);
    const available = Math.max(0, totalQty - reservedQty);
    if (qty >= available) transferError("invalid_qty", 400, { available });

    let slot = requestedSlot;
    if (!slot) {
      slot = getNextInventorySlot(db, sess.player_id, preferredContainer || existing.inv_container || INVENTORY_CONTAINER_BACKPACK);
    }
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
      .run(totalQty - qty, t, sess.impersonated ? "dm" : "player", itemId, sess.player_id);

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
    req.app.locals.io?.to(`player:${sess.player_id}`).emit("inventory:updated");
    req.app.locals.io?.to("dm").emit("inventory:updated");
    return res.json({ ok: true, id: out.splitId, slot: out.slot });
  } catch (e) {
    if (e?.code) return res.status(e.status || 400).json({ error: e.code, ...(e.extra || {}) });
    throw e;
  }
});

inventoryRouter.post("/mine/:id/quick-equip", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const itemId = Number(req.params.id);
  if (!itemId) return res.status(400).json({ error: "invalid_id" });

  const db = getDb();
  ensurePlayerLayoutSlots(db, sess.player_id);
  const tx = db.transaction(() => {
    const item = db.prepare("SELECT * FROM inventory_items WHERE id=? AND player_id=?").get(itemId, sess.player_id);
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
      itemId,
      sess.player_id
    );

    return { idempotent: false, slotX: targetSlotX, slotY: 0, swappedItemId: occupant?.id ? Number(occupant.id) : null };
  });

  try {
    const out = tx();
    req.app.locals.io?.to(`player:${sess.player_id}`).emit("inventory:updated");
    req.app.locals.io?.to("dm").emit("inventory:updated");
    return res.json({ ok: true, ...out });
  } catch (e) {
    if (e?.code) return res.status(e.status || 400).json({ error: e.code, ...(e.extra || {}) });
    throw e;
  }
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
  if (!pid) return res.status(400).json({ error: "invalid_playerId" });
  const db = getDb();
  const player = db.prepare("SELECT id, party_id FROM players WHERE id=?").get(pid);
  if (!player) return res.status(404).json({ error: "player_not_found" });
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
  ensurePlayerLayoutSlots(db, pid);
  const requestedContainer = normalizeInventoryContainer(b.container ?? b.inv_container);
  const requestedSlot = getRequestedSlot(b);
  if (requestedSlot?.error) return res.status(400).json({ error: requestedSlot.error });
  const slot = requestedSlot || getNextInventorySlot(db, pid, requestedContainer);
  const occupiedBy = findItemAtSlot(db, pid, slot.container, slot.slotX, slot.slotY);
  if (occupiedBy) return res.status(409).json({ error: "slot_occupied", itemId: Number(occupiedBy.id) });
  if (!isPlacementAllowedForItem({ name, description: desc, rarity, tags }, slot.container, slot.slotX)) {
    return res.status(400).json({ error: "invalid_equipment_slot" });
  }

  const ins2 = db.prepare(
    "INSERT INTO inventory_items(player_id, name, description, image_url, qty, weight, rarity, tags, visibility, inv_container, slot_x, slot_y, updated_at, updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).run(
    pid,
    name,
    desc,
    imageUrl || null,
    qty,
    weight,
    rarity,
    JSON.stringify(tags),
    visibility,
    slot.container,
    slot.slotX,
    slot.slotY,
    now(),
    "dm"
  );

  logEvent({
    partyId: player.party_id,
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
  ensurePlayerLayoutSlots(db, pid);
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
  const container = normalizeInventoryContainer(b.container ?? b.inv_container ?? existing.inv_container);
  const slotX = normalizeSlotCoord(b.slotX ?? b.slot_x ?? existing.slot_x);
  const slotY = normalizeSlotCoord(b.slotY ?? b.slot_y ?? existing.slot_y);
  if (!isValidSlot(container, slotX, slotY)) return res.status(400).json({ error: "invalid_slot" });
  const occupiedBy = findItemAtSlot(db, pid, container, slotX, slotY, itemId);
  if (occupiedBy) return res.status(409).json({ error: "slot_occupied", itemId: Number(occupiedBy.id) });
  if (!isPlacementAllowedForItem({ name, description: desc, rarity, tags }, container, slotX)) {
    return res.status(400).json({ error: "invalid_equipment_slot" });
  }
  const reservedQty = Number(existing.reserved_qty || 0);
  if (qty < reservedQty) return res.status(400).json({ error: "reserved_qty_exceeded" });
  const limitInfo = getInventoryLimitForPlayer(db, pid);
  if (!checkWeightLimit(db, pid, qty, weight, res, itemId, null, limitInfo.limit)) return;

  db.prepare(
    "UPDATE inventory_items SET name=?, description=?, image_url=?, qty=?, weight=?, rarity=?, tags=?, visibility=?, inv_container=?, slot_x=?, slot_y=?, updated_at=?, updated_by=? WHERE id=?"
  ).run(
    name,
    desc,
    imageUrl || null,
    qty,
    weight,
    rarity,
    JSON.stringify(tags),
    visibility,
    container,
    slotX,
    slotY,
    now(),
    "dm",
    itemId
  );

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
  const recipients = db.prepare(
    "SELECT DISTINCT to_player_id AS pid FROM item_transfers WHERE item_id=? AND status='pending'"
  ).all(itemId).map((r) => Number(r.pid));

  const tx = db.transaction(() => {
    db.prepare("UPDATE item_transfers SET status='canceled' WHERE item_id=? AND status='pending'").run(itemId);
    db.prepare("DELETE FROM inventory_items WHERE id=? AND player_id=?").run(itemId, pid);
  });
  tx();

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
  req.app.locals.io?.to(`player:${pid}`).emit("transfers:updated");
  for (const rid of recipients) {
    if (rid) req.app.locals.io?.to(`player:${rid}`).emit("transfers:updated");
  }
  req.app.locals.io?.to("dm").emit("inventory:updated");
  req.app.locals.io?.to("dm").emit("transfers:updated");
  res.json({ ok: true });
});

inventoryRouter.post("/dm/player/:playerId/bulk-visibility", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  if (!pid) return res.status(400).json({ error: "invalid_playerId" });
  const visibility = req.body?.visibility === "hidden" ? "hidden" : "public";
  const itemIds = normalizeIdList(req.body?.itemIds, 500);
  if (!itemIds.length) return res.status(400).json({ error: "empty_item_ids" });

  const db = getDb();
  const player = db.prepare("SELECT id, party_id FROM players WHERE id=?").get(pid);
  if (!player) return res.status(404).json({ error: "player_not_found" });

  const placeholders = itemIds.map(() => "?").join(",");
  const params = [pid, ...itemIds];
  const t = now();
  const result = db.prepare(
    `UPDATE inventory_items
     SET visibility=?, updated_at=?, updated_by='dm'
     WHERE player_id=?
       AND id IN (${placeholders})`
  ).run(visibility, t, ...params);

  logEvent({
    partyId: player.party_id,
    type: "inventory.bulk_visibility",
    actorRole: "dm",
    actorName: "DM",
    targetType: "player",
    targetId: Number(pid),
    message: `DM updated visibility for ${result.changes || 0} item(s) of player #${pid}`,
    data: { playerId: pid, visibility, itemIds, updated: result.changes || 0 },
    io: req.app.locals.io
  });

  req.app.locals.io?.to(`player:${pid}`).emit("inventory:updated");
  req.app.locals.io?.to("dm").emit("inventory:updated");
  res.json({ ok: true, updated: result.changes || 0 });
});

inventoryRouter.post("/dm/player/:playerId/bulk-delete", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  if (!pid) return res.status(400).json({ error: "invalid_playerId" });
  const itemIds = normalizeIdList(req.body?.itemIds, 500);
  if (!itemIds.length) return res.status(400).json({ error: "empty_item_ids" });

  const db = getDb();
  const player = db.prepare("SELECT id, party_id FROM players WHERE id=?").get(pid);
  if (!player) return res.status(404).json({ error: "player_not_found" });

  const placeholders = itemIds.map(() => "?").join(",");
  const itemRows = db.prepare(
    `SELECT id
     FROM inventory_items
     WHERE player_id=?
       AND id IN (${placeholders})`
  ).all(pid, ...itemIds);
  const existingIds = itemRows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);
  if (!existingIds.length) return res.json({ ok: true, deleted: 0 });

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
    ).run(pid, ...existingIds);
  });
  const deleted = tx()?.changes || 0;

  logEvent({
    partyId: player.party_id,
    type: "inventory.bulk_deleted",
    actorRole: "dm",
    actorName: "DM",
    targetType: "player",
    targetId: Number(pid),
    message: `DM deleted ${deleted} item(s) from player #${pid}`,
    data: { playerId: pid, itemIds: existingIds, deleted },
    io: req.app.locals.io
  });

  req.app.locals.io?.to(`player:${pid}`).emit("inventory:updated");
  req.app.locals.io?.to(`player:${pid}`).emit("transfers:updated");
  for (const rid of recipients) {
    req.app.locals.io?.to(`player:${rid}`).emit("transfers:updated");
  }
  req.app.locals.io?.to("dm").emit("inventory:updated");
  req.app.locals.io?.to("dm").emit("transfers:updated");
  res.json({ ok: true, deleted });
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
