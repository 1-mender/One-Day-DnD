import { normalizeContainer } from "./inventoryGridDomain.js";

export function getSlotItemAvailability(item) {
  const qty = Math.max(1, Number(item.qty) || 1);
  const reservedQty = Math.max(0, Number(item.reservedQty ?? item.reserved_qty) || 0);
  const availableQty = Math.max(0, qty - reservedQty);
  return { qty, reservedQty, availableQty };
}

export function getSlotHandleLabel({ readOnly, tapToMoveMode, selectedForMove }) {
  if (readOnly) return "Недоступно в режиме только чтения";
  if (tapToMoveMode) return selectedForMove ? "Отменить выбор предмета" : "Выбрать предмет для перемещения";
  return "Перетащить предмет";
}

export function buildTapTargetSlot(item) {
  return {
    container: normalizeContainer(item.container),
    slotX: Number(item.slotX),
    slotY: Number(item.slotY)
  };
}
