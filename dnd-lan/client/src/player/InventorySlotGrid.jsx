import React from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import InventorySlotBoardHint from "./inventory/grid/InventorySlotBoardHint.jsx";
import InventorySlotMoveState from "./inventory/grid/InventorySlotMoveState.jsx";
import InventorySlotTouchModeToggle from "./inventory/grid/InventorySlotTouchModeToggle.jsx";
import InventorySlotZones from "./inventory/grid/InventorySlotZones.jsx";
import SlotItem from "./inventory/grid/SlotItem.jsx";
import { useInventoryGridController } from "./inventory/grid/useInventoryGridController.js";

export default function InventorySlotGrid({
  items = [],
  readOnly = false,
  busy = false,
  touchOptimized = false,
  onMove,
  onItemOpen,
  onItemEdit,
  onTransferItem,
  onToggleFavoriteItem,
  onDeleteItem,
  onSplitItem,
  onQuickEquipItem
}) {
  const {
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
  } = useInventoryGridController({
    items,
    readOnly,
    busy,
    touchOptimized,
    onMove,
    onSplitItem
  });

  return (
    <div className={`inv-slot-board-wrap tf-slot-board${touchOptimized ? " touch-optimized" : ""}${touchOptimized && touchLiteMode ? " touch-lite" : ""}`.trim()}>
      <InventorySlotBoardHint touchOptimized={touchOptimized} tapToMoveMode={tapToMoveMode} />
      <InventorySlotTouchModeToggle
        touchOptimized={touchOptimized}
        touchLiteMode={touchLiteMode}
        setTouchLiteMode={setTouchLiteMode}
      />
      <InventorySlotMoveState
        touchOptimized={touchOptimized}
        tapToMoveMode={tapToMoveMode}
        selectedMoveItem={selectedMoveItem}
        toggleMoveSelection={toggleMoveSelection}
      />

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragCancel={onDragCancel}
        onDragEnd={onDragEnd}
      >
        <InventorySlotZones
          rowsByContainer={rowsByContainer}
          itemBySlot={itemBySlot}
          readOnly={readOnly}
          busy={busy}
          onItemOpen={onItemOpen}
          onItemEdit={onItemEdit}
          onTransferItem={onTransferItem}
          onToggleFavoriteItem={onToggleFavoriteItem}
          onDeleteItem={onDeleteItem}
          onSplitItem={onSplitItem}
          onQuickEquipItem={onQuickEquipItem}
          moveItemByKeyboard={moveItemByKeyboard}
          touchOptimized={touchOptimized}
          touchLiteMode={touchLiteMode}
          tapToMoveMode={tapToMoveMode}
          ultraNarrowScreen={ultraNarrowScreen}
          itemsCountByContainer={itemsCountByContainer}
          selectedMoveId={selectedMoveId}
          toggleMoveSelection={toggleMoveSelection}
          moveSelectedByTap={moveSelectedByTap}
          splitArmedId={splitArmedId}
          setSplitArmedId={setSplitArmedId}
        />
        {!touchOptimized ? (
          <DragOverlay>
            {activeItem ? (
              <SlotItem item={activeItem} dragging readOnly={readOnly || busy} splitArmed={dragMode === "split"} />
            ) : null}
          </DragOverlay>
        ) : null}
      </DndContext>
    </div>
  );
}
