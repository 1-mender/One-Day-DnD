import React, { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { GripVertical, MoreHorizontal } from "lucide-react";
import { pickInventoryIcon } from "../components/vintage/InventoryItemCard.jsx";

const CONTAINERS = [
  { key: "equipment", label: "Экипировка", cols: 4, rows: 1, minRows: 1 },
  { key: "hotbar", label: "Пояс", cols: 6, rows: 1, minRows: 1 },
  { key: "backpack", label: "Рюкзак", cols: 6, rows: 100, minRows: 4, dynamicRows: true }
];

const CONTAINER_BY_KEY = Object.fromEntries(CONTAINERS.map((container) => [container.key, container]));
const DEFAULT_CONTAINER = "backpack";

export default function InventorySlotGrid({
  items = [],
  readOnly = false,
  busy = false,
  onMove,
  onItemOpen,
  onTransferItem,
  onToggleFavoriteItem,
  onDeleteItem,
  onSplitItem
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } })
  );
  const [activeId, setActiveId] = useState(null);

  const normalizedItems = useMemo(() => normalizeItems(items), [items]);
  const itemsById = useMemo(() => new Map(normalizedItems.map((item) => [item.id, item])), [normalizedItems]);
  const itemBySlot = useMemo(() => {
    const map = new Map();
    for (const item of normalizedItems) {
      map.set(makeSlotKey(item.container, item.slotX, item.slotY), item);
    }
    return map;
  }, [normalizedItems]);
  const rowsByContainer = useMemo(() => buildRowsByContainer(normalizedItems), [normalizedItems]);
  const activeItem = activeId != null ? itemsById.get(activeId) : null;

  return (
    <div className="inv-slot-board-wrap">
      <div className="small inv-slot-hint">
        RPG-сетка: drag за <GripVertical className="icon" aria-hidden="true" />, контекст через <MoreHorizontal className="icon" aria-hidden="true" />.
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={(event) => {
          setActiveId(parseItemId(event.active?.id));
        }}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={async (event) => {
          setActiveId(null);
          if (readOnly || busy || typeof onMove !== "function") return;
          const draggedId = parseItemId(event.active?.id);
          const overSlot = parseSlotId(event.over?.id);
          if (!draggedId || !overSlot) return;
          const dragged = itemsById.get(draggedId);
          if (!dragged) return;
          if (
            dragged.container === overSlot.container
            && dragged.slotX === overSlot.slotX
            && dragged.slotY === overSlot.slotY
          ) return;
          const target = itemBySlot.get(makeSlotKey(overSlot.container, overSlot.slotX, overSlot.slotY));
          const moves = [{ id: dragged.id, ...overSlot }];
          if (target && target.id !== dragged.id) {
            moves.push({
              id: target.id,
              container: dragged.container,
              slotX: dragged.slotX,
              slotY: dragged.slotY
            });
          }
          await onMove(moves);
        }}
      >
        <div className="inv-slot-zones">
          {CONTAINERS.map((container) => (
            <ContainerGrid
              key={container.key}
              container={container}
              rows={rowsByContainer[container.key]}
              itemBySlot={itemBySlot}
              readOnly={readOnly || busy}
              onItemOpen={onItemOpen}
              onTransferItem={onTransferItem}
              onToggleFavoriteItem={onToggleFavoriteItem}
              onDeleteItem={onDeleteItem}
              onSplitItem={onSplitItem}
            />
          ))}
        </div>
        <DragOverlay>
          {activeItem ? (
            <SlotItem item={activeItem} dragging readOnly={readOnly || busy} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function ContainerGrid({
  container,
  rows,
  itemBySlot,
  readOnly,
  onItemOpen,
  onTransferItem,
  onToggleFavoriteItem,
  onDeleteItem,
  onSplitItem
}) {
  return (
    <section className="inv-slot-zone">
      <div className="inv-slot-zone-head">
        <h4>{container.label}</h4>
      </div>
      <div className="inv-slot-grid" style={{ gridTemplateColumns: `repeat(${container.cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: rows * container.cols }).map((_, index) => {
          const slotX = index % container.cols;
          const slotY = Math.floor(index / container.cols);
          const key = makeSlotKey(container.key, slotX, slotY);
          const item = itemBySlot.get(key) || null;
          return (
            <SlotCell
              key={key}
              container={container.key}
              slotX={slotX}
              slotY={slotY}
              item={item}
              readOnly={readOnly}
              onItemOpen={onItemOpen}
              onTransferItem={onTransferItem}
              onToggleFavoriteItem={onToggleFavoriteItem}
              onDeleteItem={onDeleteItem}
              onSplitItem={onSplitItem}
            />
          );
        })}
      </div>
    </section>
  );
}

function SlotCell({
  container,
  slotX,
  slotY,
  item,
  readOnly,
  onItemOpen,
  onTransferItem,
  onToggleFavoriteItem,
  onDeleteItem,
  onSplitItem
}) {
  const id = makeSlotId(container, slotX, slotY);
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`inv-slot-cell${isOver ? " active" : ""}${item ? " occupied" : ""}`.trim()}
      data-slot={`${container}:${slotX}:${slotY}`}
    >
      {item ? (
        <SlotItem
          item={item}
          readOnly={readOnly}
          onOpen={onItemOpen}
          onTransferItem={onTransferItem}
          onToggleFavoriteItem={onToggleFavoriteItem}
          onDeleteItem={onDeleteItem}
          onSplitItem={onSplitItem}
        />
      ) : (
        <div className="inv-slot-empty" aria-hidden="true" />
      )}
    </div>
  );
}

function SlotItem({
  item,
  readOnly,
  dragging = false,
  onOpen,
  onTransferItem,
  onToggleFavoriteItem,
  onDeleteItem,
  onSplitItem
}) {
  const draggableId = makeItemId(item.id);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    disabled: readOnly
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const icon = pickInventoryIcon(item);
  const qty = Math.max(1, Number(item.qty) || 1);
  const reservedQty = Math.max(0, Number(item.reservedQty ?? item.reserved_qty) || 0);
  const availableQty = Math.max(0, qty - reservedQty);
  const canSplit = availableQty >= 2;

  return (
    <div
      ref={setNodeRef}
      className={`inv-slot-item${isDragging || dragging ? " dragging" : ""}`.trim()}
      style={style}
      aria-label={`${item.name || "Предмет"} x${qty}`}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen((prev) => !prev);
      }}
    >
      <button
        type="button"
        className="inv-slot-open"
        onClick={() => onOpen?.(item)}
        title={`${item.name || "Предмет"} x${qty}`}
      >
        {icon.Icon ? (
          <icon.Icon className="inv-slot-icon" aria-hidden="true" />
        ) : (
          <span className="inv-slot-fallback">{icon.text}</span>
        )}
        <span className="inv-slot-name">{item.name || "Без названия"}</span>
      </button>
      <div className="inv-slot-meta">
        <span className="inv-slot-qty">x{qty}</span>
        {reservedQty > 0 ? <span className="inv-slot-reserved">{availableQty}</span> : null}
      </div>
      <div className="inv-slot-actions">
        <button
          type="button"
          className="inv-slot-handle"
          disabled={readOnly}
          title={readOnly ? "Недоступно в read-only" : "Перетащить предмет"}
          aria-label={readOnly ? "Недоступно в read-only" : "Перетащить предмет"}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="icon" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="inv-slot-menu-btn"
          onClick={() => setMenuOpen((prev) => !prev)}
          title="Контекст"
          aria-label="Контекст"
        >
          <MoreHorizontal className="icon" aria-hidden="true" />
        </button>
      </div>
      {menuOpen ? (
        <div className="inv-slot-menu" role="menu">
          <button type="button" onClick={() => { onOpen?.(item); setMenuOpen(false); }}>Редактировать</button>
          <button type="button" onClick={() => { onTransferItem?.(item); setMenuOpen(false); }} disabled={readOnly || availableQty <= 0}>Передать</button>
          <button type="button" onClick={() => { onSplitItem?.(item); setMenuOpen(false); }} disabled={readOnly || !canSplit}>Разделить стак</button>
          <button type="button" onClick={() => { onToggleFavoriteItem?.(item); setMenuOpen(false); }} disabled={readOnly}>Избранное</button>
          <button type="button" className="danger" onClick={() => { onDeleteItem?.(item); setMenuOpen(false); }} disabled={readOnly}>Удалить</button>
        </div>
      ) : null}
    </div>
  );
}

function normalizeItems(list) {
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

function buildRowsByContainer(items) {
  const rowsByContainer = {};
  for (const container of CONTAINERS) {
    const maxY = items
      .filter((item) => item.container === container.key)
      .reduce((acc, item) => Math.max(acc, item.slotY), -1);
    const rows = container.dynamicRows
      ? Math.max(container.minRows, maxY + 2)
      : Math.max(container.minRows, container.rows);
    rowsByContainer[container.key] = rows;
  }
  return rowsByContainer;
}

function normalizeContainer(value) {
  const key = String(value || "").trim().toLowerCase();
  return CONTAINER_BY_KEY[key] ? key : DEFAULT_CONTAINER;
}

function makeSlotKey(container, slotX, slotY) {
  return `${container}:${slotX}:${slotY}`;
}

function makeSlotId(container, slotX, slotY) {
  return `slot:${container}:${slotX}:${slotY}`;
}

function makeItemId(id) {
  return `item:${id}`;
}

function parseSlotId(id) {
  const raw = String(id || "");
  const m = raw.match(/^slot:([a-z_]+):(\d+):(\d+)$/);
  if (!m) return null;
  return { container: normalizeContainer(m[1]), slotX: Number(m[2]), slotY: Number(m[3]) };
}

function parseItemId(id) {
  const raw = String(id || "");
  const m = raw.match(/^item:(\d+)$/);
  if (!m) return null;
  return Number(m[1]);
}

function normalizeSlot(primary, fallback) {
  const raw = primary ?? fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}
