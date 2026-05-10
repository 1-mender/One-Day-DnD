import { CONTAINER_BY_KEY, makeSlotKey, normalizeContainer } from "./inventoryGridDomain.js";

export function isSameInventorySlot(item, slot) {
  return (
    item.container === slot.container
    && item.slotX === slot.slotX
    && item.slotY === slot.slotY
  );
}

export function getKeyboardTargetSlot({ item, deltaX, deltaY, rowsByContainer }) {
  const container = normalizeContainer(item.container);
  const spec = CONTAINER_BY_KEY[container];
  if (!spec) return null;

  const maxRows = Number(rowsByContainer[container]) || spec.rows || spec.minRows || 1;
  const slotX = Number(item.slotX) + Number(deltaX || 0);
  const slotY = Number(item.slotY) + Number(deltaY || 0);

  if (!Number.isInteger(slotX) || !Number.isInteger(slotY)) return null;
  if (slotX < 0 || slotX >= spec.cols || slotY < 0 || slotY >= maxRows) return null;

  return { container, slotX, slotY };
}

export function buildInventoryMovePayload({ item, targetSlot, target }) {
  const moves = [{ id: item.id, ...targetSlot }];
  if (target && target.id !== item.id) {
    moves.push({
      id: target.id,
      container: item.container,
      slotX: item.slotX,
      slotY: item.slotY
    });
  }
  return moves;
}

export function getTargetItemForSlot(itemBySlot, slot) {
  return itemBySlot.get(makeSlotKey(slot.container, slot.slotX, slot.slotY));
}
