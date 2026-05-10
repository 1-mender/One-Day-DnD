export const EMPTY_INVENTORY_FORM = {
  name: "",
  description: "",
  qty: 1,
  weight: 0,
  rarity: "common",
  tags: [],
  visibility: "public",
  iconKey: ""
};

export const FAVORITE_TAG = "favorite";
export const INPUT_FULL_WIDTH_STYLE = { width: "100%" };

export function getItemAvailableQty(item) {
  const qty = Number(item?.qty || 0);
  const reservedQty = Number(item?.reservedQty ?? item?.reserved_qty ?? 0);
  return Math.max(0, qty - reservedQty);
}

export function getSplitInputMax(item) {
  return Math.max(1, getItemAvailableQty(item) - 1);
}

export function filterInventory(items, { q, vis, rarity }) {
  const list = items || [];
  const qq = String(q || "").toLowerCase().trim();
  return list.filter((it) => {
    if (vis && String(it.visibility) !== vis) return false;
    if (rarity && String(it.rarity || "") !== rarity) return false;
    if (!qq) return true;
    return String(it.name || "").toLowerCase().includes(qq);
  });
}

export function summarizeInventory(list) {
  return (list || []).reduce((acc, it) => {
    const qty = Number(it.qty) || 1;
    const weight = Number(it.weight) || 0;
    acc.totalWeight += weight * qty;
    if (String(it.visibility) === "hidden") acc.hiddenCount += 1;
    else acc.publicCount += 1;
    return acc;
  }, { totalWeight: 0, publicCount: 0, hiddenCount: 0 });
}

export function applyLayoutMoves(list, moves) {
  const items = Array.isArray(list) ? [...list] : [];
  const map = new Map((Array.isArray(moves) ? moves : [])
    .filter((move) => Number(move?.id) > 0)
    .map((move) => [Number(move.id), move]));
  if (!map.size) return items;
  return items.map((item) => {
    const patch = map.get(Number(item?.id));
    if (!patch) return item;
    return {
      ...item,
      container: patch.container,
      inv_container: patch.container,
      slotX: Number(patch.slotX),
      slotY: Number(patch.slotY),
      slot_x: Number(patch.slotX),
      slot_y: Number(patch.slotY)
    };
  });
}

export function filterIconSections(sections, query) {
  const list = Array.isArray(sections) ? sections : [];
  const q = String(query || "").toLowerCase().trim();
  if (!q) return list;
  return list
    .map((section) => {
      const items = (section.items || []).filter((icon) => {
        const hay = `${icon.label || ""} ${icon.key || ""}`.toLowerCase();
        return hay.includes(q);
      });
      return items.length ? { ...section, items } : null;
    })
    .filter(Boolean);
}
