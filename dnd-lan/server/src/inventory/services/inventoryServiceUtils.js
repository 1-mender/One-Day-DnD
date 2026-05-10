import { now } from "../../util.js";
import { getInventoryLimitForPlayer } from "../../inventoryLimit.js";

export const TRANSFER_MAX_QTY = 9999;
export const TRANSFER_NOTE_MAX = 140;
export const TRANSFER_TTL_MS = Number(process.env.INVENTORY_TRANSFER_TTL_MS || 3 * 24 * 60 * 60 * 1000);

export function toFiniteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function getInventoryTotalWeight(db, playerId, excludeItemId = null) {
  const row = excludeItemId
    ? db.prepare("SELECT SUM(weight * qty) AS total FROM inventory_items WHERE player_id=? AND id<>?").get(playerId, excludeItemId)
    : db.prepare("SELECT SUM(weight * qty) AS total FROM inventory_items WHERE player_id=?").get(playerId);
  const total = Number(row?.total ?? 0);
  return Number.isFinite(total) ? total : 0;
}

export function checkWeightLimit(db, playerId, {
  nextQty,
  nextWeight,
  excludeItemId = null,
  currentTotal = null,
  limitOverride = null
} = {}) {
  const raw = Number.isFinite(limitOverride) ? Number(limitOverride) : Number(getInventoryLimitForPlayer(db, playerId).limit || 0);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const base = getInventoryTotalWeight(db, playerId, excludeItemId);
  const projected = base + (Number(nextQty || 0) * Number(nextWeight || 0));
  const totalNow = Number.isFinite(currentTotal)
    ? Number(currentTotal)
    : (excludeItemId == null ? base : getInventoryTotalWeight(db, playerId));
  if (projected > raw && projected > totalNow) {
    return { error: "weight_limit_exceeded", status: 400, limit: raw, projected };
  }
  return null;
}

export function transferError(code, status = 400, extra = null) {
  const err = new Error(code);
  err.code = code;
  err.status = status;
  if (extra) err.extra = extra;
  throw err;
}

export function expireTransfer(db, tr, t = now()) {
  const item = db.prepare("SELECT id, reserved_qty FROM inventory_items WHERE id=? AND player_id=?")
    .get(tr.item_id, tr.from_player_id);
  if (item) {
    const reservedQty = Number(item.reserved_qty || 0);
    const nextReserved = Math.max(0, reservedQty - Number(tr.qty || 0));
    db.prepare("UPDATE inventory_items SET reserved_qty=?, updated_at=? WHERE id=?").run(nextReserved, t, item.id);
  }
  db.prepare("UPDATE item_transfers SET status='expired' WHERE id=?").run(tr.id);
}

export function parseTransferQty(value) {
  const qty = Math.floor(toFiniteNumber(value, NaN));
  if (!Number.isFinite(qty)) return NaN;
  return qty;
}
