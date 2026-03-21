export const TRANSFER_REFRESH_MS = 30_000;

export function filterTransfers(list, query) {
  const items = Array.isArray(list) ? list : [];
  const q = String(query || "").toLowerCase().trim();
  if (!q) return items;
  return items.filter((transfer) => {
    const haystack = [
      transfer.itemName,
      transfer.toName,
      transfer.fromName,
      transfer.note,
      String(transfer.toPlayerId || ""),
      String(transfer.fromPlayerId || "")
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
