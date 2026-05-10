import { PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useEffect, useMemo, useState } from "react";
import {
  CONTAINERS,
  buildRowsByContainer,
  isSplittableItem,
  makeSlotKey,
  normalizeItems,
  parseItemId,
  parseSlotId
} from "./inventoryGridDomain.js";
import {
  buildInventoryMovePayload,
  getKeyboardTargetSlot,
  getTargetItemForSlot,
  isSameInventorySlot,
} from "./inventoryGridMoveDomain.js";
import { useMediaQuery } from "./useMediaQuery.js";

export function useInventoryGridController({
  items,
  readOnly,
  busy,
  touchOptimized,
  onMove,
  onSplitItem
}) {
  const ultraNarrowScreen = useMediaQuery("(max-width: 360px)");
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 6 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } });
  const [activeId, setActiveId] = useState(null);
  const [splitArmedId, setSplitArmedId] = useState(null);
  const [dragMode, setDragMode] = useState("move");
  const [selectedMoveId, setSelectedMoveId] = useState(null);
  const [touchLiteMode, setTouchLiteMode] = useState(false);
  const tapToMoveMode = touchOptimized && touchLiteMode;
  const sensors = useSensors(...(
    tapToMoveMode
      ? []
      : (touchOptimized ? [touchSensor] : [pointerSensor, touchSensor])
  ));

  const normalizedItems = useMemo(() => normalizeItems(items), [items]);
  const itemsById = useMemo(() => new Map(normalizedItems.map((item) => [item.id, item])), [normalizedItems]);
  const itemBySlot = useMemo(() => {
    const map = new Map();
    for (const item of normalizedItems) {
      map.set(makeSlotKey(item.container, item.slotX, item.slotY), item);
    }
    return map;
  }, [normalizedItems]);
  const rowsByContainer = useMemo(
    () => buildRowsByContainer(normalizedItems, touchOptimized || tapToMoveMode),
    [normalizedItems, tapToMoveMode, touchOptimized]
  );
  const itemsCountByContainer = useMemo(() => {
    const byContainer = {};
    for (const container of CONTAINERS) byContainer[container.key] = 0;
    for (const item of normalizedItems) {
      byContainer[item.container] = (byContainer[item.container] || 0) + 1;
    }
    return byContainer;
  }, [normalizedItems]);
  const activeItem = activeId != null ? itemsById.get(activeId) : null;
  const selectedMoveItem = selectedMoveId != null ? itemsById.get(selectedMoveId) : null;

  const moveItemByKeyboard = async (item, deltaX, deltaY) => {
    if (readOnly || busy || typeof onMove !== "function" || !item) return;
    const targetSlot = getKeyboardTargetSlot({ item, deltaX, deltaY, rowsByContainer });
    if (!targetSlot || isSameInventorySlot(item, targetSlot)) return;
    const target = getTargetItemForSlot(itemBySlot, targetSlot);
    const moves = buildInventoryMovePayload({ item, targetSlot, target });
    await onMove(moves);
  };

  const moveSelectedByTap = async (targetSlot) => {
    if (!tapToMoveMode || readOnly || busy || typeof onMove !== "function") return;
    if (!targetSlot || !Number.isInteger(targetSlot.slotX) || !Number.isInteger(targetSlot.slotY)) return;
    if (selectedMoveId == null) return;
    const selected = itemsById.get(selectedMoveId);
    if (!selected) {
      setSelectedMoveId(null);
      return;
    }
    if (isSameInventorySlot(selected, targetSlot)) {
      setSelectedMoveId(null);
      return;
    }
    const target = getTargetItemForSlot(itemBySlot, targetSlot);
    const moves = buildInventoryMovePayload({ item: selected, targetSlot, target });
    await onMove(moves);
    setSelectedMoveId(null);
  };

  const toggleMoveSelection = (id) => {
    if (!tapToMoveMode || readOnly || busy) return;
    setSplitArmedId(null);
    setSelectedMoveId((current) => (current === id ? null : id));
  };

  useEffect(() => {
    if (!tapToMoveMode && selectedMoveId != null) {
      setSelectedMoveId(null);
      return;
    }
    if (selectedMoveId != null && !itemsById.has(selectedMoveId)) {
      setSelectedMoveId(null);
    }
  }, [itemsById, selectedMoveId, tapToMoveMode]);

  useEffect(() => {
    if (!touchOptimized) {
      setTouchLiteMode(false);
      return;
    }
    setTouchLiteMode(false);
  }, [touchOptimized]);

  const onDragStart = (event) => {
    if (tapToMoveMode) return;
    const id = parseItemId(event.active?.id);
    setActiveId(id);
    setSelectedMoveId(null);
    const item = id != null ? itemsById.get(id) : null;
    const splitMode = id != null && id === splitArmedId && isSplittableItem(item);
    setDragMode(splitMode ? "split" : "move");
    setSplitArmedId(null);
  };

  const onDragCancel = () => {
    setActiveId(null);
    setDragMode("move");
    setSplitArmedId(null);
  };

  const onDragEnd = async (event) => {
    if (tapToMoveMode) return;
    setActiveId(null);
    const mode = dragMode;
    setDragMode("move");
    setSplitArmedId(null);
    if (readOnly || busy) return;
    const draggedId = parseItemId(event.active?.id);
    const overSlot = parseSlotId(event.over?.id);
    if (!draggedId || !overSlot) return;
    const dragged = itemsById.get(draggedId);
    if (!dragged) return;
    if (isSameInventorySlot(dragged, overSlot)) return;
    const target = getTargetItemForSlot(itemBySlot, overSlot);
    if (mode === "split") {
      if (typeof onSplitItem === "function") onSplitItem(dragged, overSlot, target || null);
      return;
    }
    if (typeof onMove !== "function") return;
    const moves = buildInventoryMovePayload({ item: dragged, targetSlot: overSlot, target });
    await onMove(moves);
  };

  return {
    ultraNarrowScreen,
    touchLiteMode,
    setTouchLiteMode,
    tapToMoveMode,
    dragMode,
    sensors,
    itemBySlot,
    rowsByContainer,
    itemsCountByContainer,
    activeItem,
    selectedMoveItem,
    selectedMoveId,
    splitArmedId,
    moveItemByKeyboard,
    moveSelectedByTap,
    toggleMoveSelection,
    setSplitArmedId,
    onDragStart,
    onDragCancel,
    onDragEnd
  };
}
