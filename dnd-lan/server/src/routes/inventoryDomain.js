import { jsonParse, now } from "../util.js";

export const INVENTORY_CONTAINER_BACKPACK = "backpack";
export const INVENTORY_CONTAINER_HOTBAR = "hotbar";
export const INVENTORY_CONTAINER_EQUIPMENT = "equipment";
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

export function normalizeIdList(input, max = 300) {
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

export function normalizeInventoryContainer(value) {
  const key = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(INVENTORY_LAYOUT, key)
    ? key
    : INVENTORY_CONTAINER_BACKPACK;
}

export function normalizeSlotCoord(value) {
  const n = Math.floor(toFiniteNumber(value, NaN));
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > INVENTORY_SLOT_MAX) return null;
  return n;
}

export function isValidSlot(container, slotX, slotY) {
  const spec = INVENTORY_LAYOUT[container];
  return !!spec
    && Number.isInteger(slotX)
    && Number.isInteger(slotY)
    && slotX >= 0
    && slotX < spec.cols
    && slotY >= 0
    && slotY < spec.rows;
}

export function makeSlotKey(container, slotX, slotY) {
  return `${container}:${slotX}:${slotY}`;
}

export function allocateNextSlot(occupied, container = INVENTORY_CONTAINER_BACKPACK) {
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

export function getRequestedSlot(body) {
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

export function findItemAtSlot(db, playerId, container, slotX, slotY, excludeItemId = null) {
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

export function allowedEquipmentSlotsForItem(item) {
  const text = collectItemTokens(item).join(" ");
  const has = (list) => list.some((word) => text.includes(word));
  if (has(["armor", "armour", "брон", "доспех", "кольч", "латы", "helmet", "helm", "шлем"])) return [2];
  if (has(["shield", "щит", "buckler"])) return [1];
  if (has(["sword", "blade", "axe", "bow", "spear", "staff", "wand", "weapon", "меч", "топор", "лук", "копь", "посох", "жезл", "оруж"])) return [0];
  if (has(["ring", "amulet", "jewel", "accessory", "кольц", "амулет", "ожерель", "талисман", "кулон"])) return [3];
  return [];
}

export function isPlacementAllowedForItem(item, container, slotX) {
  const normalizedContainer = normalizeInventoryContainer(container);
  if (normalizedContainer !== INVENTORY_CONTAINER_EQUIPMENT) return true;
  const allowed = allowedEquipmentSlotsForItem(item);
  if (!allowed.length) return false;
  return allowed.includes(Number(slotX));
}

export function ensurePlayerLayoutSlots(db, playerId) {
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

export function getNextInventorySlot(db, playerId, container = INVENTORY_CONTAINER_BACKPACK) {
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

export function mapInventoryRow(row) {
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

export function parseLayoutMoves(input, max = 300) {
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
