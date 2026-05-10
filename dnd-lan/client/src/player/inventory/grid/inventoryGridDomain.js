export const CONTAINERS = [
  { key: "equipment", label: "Экипировка", cols: 4, rows: 1, minRows: 1 },
  { key: "hotbar", label: "Пояс", cols: 6, rows: 1, minRows: 1 },
  { key: "backpack", label: "Рюкзак", cols: 6, rows: 100, minRows: 4, dynamicRows: true }
];

export const CONTAINER_BY_KEY = Object.fromEntries(CONTAINERS.map((container) => [container.key, container]));
export const DEFAULT_CONTAINER = "backpack";

export function normalizeItems(list) {
  const out = [];
  const occupied = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const item = raw || {};
    const id = Number(item.id);
    if (!id) continue;
    const container = normalizeContainer(item.container ?? item.inv_container);
    const spec = CONTAINER_BY_KEY[container];
    const slotX = normalizeSlot(item.slotX, item.slot_x);
    const slotY = normalizeSlot(item.slotY, item.slot_y);
    if (slotX == null || slotY == null) continue;
    if (!spec || slotX >= spec.cols || slotY >= spec.rows) continue;
    const key = makeSlotKey(container, slotX, slotY);
    if (occupied.has(key)) continue;
    occupied.add(key);
    out.push({ ...item, id, container, slotX, slotY });
  }
  return out;
}

export function buildRowsByContainer(items, touchLiteMode = false) {
  const rowsByContainer = {};
  for (const container of CONTAINERS) {
    const maxY = items
      .filter((item) => item.container === container.key)
      .reduce((acc, item) => Math.max(acc, item.slotY), -1);
    const rows = container.dynamicRows
      ? (
        touchLiteMode
          ? Math.max(2, maxY + 1)
          : Math.max(container.minRows, maxY + 2)
      )
      : Math.max(container.minRows, container.rows);
    rowsByContainer[container.key] = rows;
  }
  return rowsByContainer;
}

export function getTouchLiteCols(containerKey) {
  if (containerKey === "equipment") return 2;
  if (containerKey === "hotbar") return 3;
  return 3;
}

export function normalizeContainer(value) {
  const key = String(value || "").trim().toLowerCase();
  return CONTAINER_BY_KEY[key] ? key : DEFAULT_CONTAINER;
}

export function isSplittableItem(item) {
  if (!item) return false;
  const qty = Math.max(1, Number(item.qty) || 1);
  const reservedQty = Math.max(0, Number(item.reservedQty ?? item.reserved_qty) || 0);
  return qty - reservedQty >= 2;
}

export function makeSlotKey(container, slotX, slotY) {
  return `${container}:${slotX}:${slotY}`;
}

export function makeSlotId(container, slotX, slotY) {
  return `slot:${container}:${slotX}:${slotY}`;
}

export function makeItemId(id) {
  return `item:${id}`;
}

export function parseSlotId(id) {
  const raw = String(id || "");
  const m = raw.match(/^slot:([a-z_]+):(\d+):(\d+)$/);
  if (!m) return null;
  return { container: normalizeContainer(m[1]), slotX: Number(m[2]), slotY: Number(m[3]) };
}

export function parseItemId(id) {
  const raw = String(id || "");
  const m = raw.match(/^item:(\d+)$/);
  if (!m) return null;
  return Number(m[1]);
}

export function normalizeSlot(primary, fallback) {
  const raw = primary ?? fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}
