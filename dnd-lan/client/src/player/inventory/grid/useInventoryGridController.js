import { PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useEffect, useMemo, useState } from "react";
import {
  CONTAINERS,
  CONTAINER_BY_KEY,
  buildRowsByContainer,
  isSplittableItem,
  makeSlotKey,
  normalizeContainer,
  normalizeItems,
  parseItemId,
  parseSlotId
} from "./inventoryGridDomain.js";

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
    () => buildRowsByContainer(normalizedItems, tapToMoveMode),
    [normalizedItems, tapToMoveMode]
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
    const container = normalizeContainer(item.container);
    const spec = CONTAINER_BY_KEY[container];
    if (!spec) return;
    const maxRows = Number(rowsByContainer[container]) || spec.rows || spec.minRows || 1;
    const slotX = Number(item.slotX) + Number(deltaX || 0);
    const slotY = Number(item.slotY) + Number(deltaY || 0);
    if (!Number.isInteger(slotX) || !Number.isInteger(slotY)) return;
    if (slotX < 0 || slotX >= spec.cols || slotY < 0 || slotY >= maxRows) return;
    if (slotX === item.slotX && slotY === item.slotY) return;

    const target = itemBySlot.get(makeSlotKey(container, slotX, slotY));
    const moves = [{ id: item.id, container, slotX, slotY }];
    if (target && target.id !== item.id) {
      moves.push({
        id: target.id,
        container: item.container,
        slotX: item.slotX,
        slotY: item.slotY
      });
    }
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
    if (
      selected.container === targetSlot.container
      && selected.slotX === targetSlot.slotX
      && selected.slotY === targetSlot.slotY
    ) {
      setSelectedMoveId(null);
      return;
    }
    const target = itemBySlot.get(makeSlotKey(targetSlot.container, targetSlot.slotX, targetSlot.slotY));
    const moves = [{ id: selected.id, ...targetSlot }];
    if (target && target.id !== selected.id) {
      moves.push({
        id: target.id,
        container: selected.container,
        slotX: selected.slotX,
        slotY: selected.slotY
      });
    }
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
    if (
      dragged.container === overSlot.container
      && dragged.slotX === overSlot.slotX
      && dragged.slotY === overSlot.slotY
    ) return;
    const target = itemBySlot.get(makeSlotKey(overSlot.container, overSlot.slotX, overSlot.slotY));
    if (mode === "split") {
      if (typeof onSplitItem === "function") onSplitItem(dragged, overSlot, target || null);
      return;
    }
    if (typeof onMove !== "function") return;
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

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return () => {};
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    if (media.addEventListener) media.addEventListener("change", update);
    else if (media.addListener) media.addListener(update);
    return () => {
      if (media.removeEventListener) media.removeEventListener("change", update);
      else if (media.removeListener) media.removeListener(update);
    };
  }, [query]);

  return matches;
}
