export function getItemAvailableQty(item) {
  const qty = Number(item?.qty || 0);
  const reservedQty = Number(item?.reservedQty ?? item?.reserved_qty ?? 0);
  return Math.max(0, qty - reservedQty);
}

export function getSplitInputMax(item) {
  return Math.max(1, getItemAvailableQty(item) - 1);
}
