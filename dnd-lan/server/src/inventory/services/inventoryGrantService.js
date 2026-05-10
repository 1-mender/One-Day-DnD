import { getInventoryLimitForPlayer } from "../../inventoryLimit.js";
import {
  ensurePlayerLayoutSlots,
  findItemAtSlot,
  getNextInventorySlot,
  isPlacementAllowedForItem
} from "../domain/inventoryDomain.js";
import { checkWeightLimit } from "./inventoryServiceUtils.js";

function grantError(code, status = 400, extra = null) {
  const err = new Error(code);
  err.code = code;
  err.status = status;
  if (extra) err.extra = extra;
  throw err;
}

export function grantInventoryItem({
  db,
  playerId,
  item,
  nowValue,
  updatedBy = "system"
}) {
  const payload = {
    name: String(item?.name || "").trim(),
    description: String(item?.description || ""),
    imageUrl: String(item?.imageUrl || item?.image_url || ""),
    qty: Math.max(1, Number(item?.qty || 1)),
    weight: Math.max(0, Number(item?.weight || 0)),
    rarity: String(item?.rarity || "common"),
    visibility: item?.visibility === "public" ? "public" : "hidden",
    tags: Array.isArray(item?.tags) ? item.tags.map(String).filter(Boolean) : []
  };
  if (!payload.name) grantError("name_required", 400);

  ensurePlayerLayoutSlots(db, playerId);
  const slot = getNextInventorySlot(db, playerId, item?.container || "backpack");
  if (!slot) grantError("inventory_full", 409);

  const occupiedBy = findItemAtSlot(db, playerId, slot.container, slot.slotX, slot.slotY);
  if (occupiedBy) grantError("slot_occupied", 409, { itemId: Number(occupiedBy.id) });
  if (!isPlacementAllowedForItem(payload, slot.container, slot.slotX)) {
    grantError("invalid_equipment_slot", 400);
  }

  const limitInfo = getInventoryLimitForPlayer(db, playerId);
  const weightError = checkWeightLimit(db, playerId, {
    nextQty: payload.qty,
    nextWeight: payload.weight,
    limitOverride: limitInfo.limit
  });
  if (weightError) {
    grantError(weightError.error, weightError.status, {
      limit: weightError.limit,
      projected: weightError.projected
    });
  }

  const result = db.prepare(
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
    nowValue,
    updatedBy
  );

  return {
    id: Number(result.lastInsertRowid),
    ...payload,
    imageUrl: payload.imageUrl || "",
    container: slot.container,
    slotX: slot.slotX,
    slotY: slot.slotY
  };
}
