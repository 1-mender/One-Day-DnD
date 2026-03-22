import React from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { GripVertical, MoreHorizontal } from "lucide-react";
import ContainerGrid from "./inventory/grid/ContainerGrid.jsx";
import SlotItem from "./inventory/grid/SlotItem.jsx";
import { CONTAINERS } from "./inventory/grid/inventoryGridDomain.js";
import { useInventoryGridController } from "./inventory/grid/useInventoryGridController.js";

export default function InventorySlotGrid({
  items = [],
  readOnly = false,
  busy = false,
  touchOptimized = false,
  onMove,
  onItemOpen,
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
      <div className="small inv-slot-hint tf-slot-hint">
        {touchOptimized && tapToMoveMode ? (
          <>RPG-сетка (тач): включен Lite-режим. Выберите предмет кнопкой <GripVertical className="icon" aria-hidden="true" />, затем тапните целевой слот.</>
        ) : touchOptimized ? (
          <>RPG-сетка (тач): режим Классика. Перетаскивайте предмет за <GripVertical className="icon" aria-hidden="true" />.</>
        ) : (
          <>RPG-сетка: перетаскивайте за <GripVertical className="icon" aria-hidden="true" />, контекст через <MoreHorizontal className="icon" aria-hidden="true" />, клавиатура: Alt + стрелки.</>
        )}
      </div>
      {touchOptimized ? (
        <div className="inv-slot-mobile-mode tf-segmented">
          <button
            type="button"
            className={`btn tf-segmented-btn ${touchLiteMode ? "tf-segmented-btn-active" : "secondary"}`.trim()}
            onClick={() => setTouchLiteMode(true)}
          >
            Lite
          </button>
          <button
            type="button"
            className={`btn tf-segmented-btn ${touchLiteMode ? "secondary" : "tf-segmented-btn-active"}`.trim()}
            onClick={() => setTouchLiteMode(false)}
          >
            Классика
          </button>
        </div>
      ) : null}
      {touchOptimized && tapToMoveMode && selectedMoveItem ? (
        <div className="inv-slot-touch-state tf-panel">
          <span>Перемещение: <b>{selectedMoveItem.name || "Без названия"}</b>. Тапните слот назначения.</span>
          <button type="button" className="btn secondary" onClick={() => toggleMoveSelection(selectedMoveItem.id)}>Отмена</button>
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragCancel={onDragCancel}
        onDragEnd={onDragEnd}
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
              onQuickEquipItem={onQuickEquipItem}
              onKeyboardMoveItem={moveItemByKeyboard}
              touchOptimized={touchOptimized}
              touchLiteMode={touchLiteMode}
              tapToMoveMode={tapToMoveMode}
              compactTouch={ultraNarrowScreen}
              hasItems={(itemsCountByContainer[container.key] || 0) > 0}
              selectedMoveId={selectedMoveId}
              onToggleMoveSelection={toggleMoveSelection}
              onTapTargetSlot={moveSelectedByTap}
              splitArmedId={splitArmedId}
              onArmSplit={(id) => setSplitArmedId(id)}
              onCancelSplitArm={(id) => setSplitArmedId((current) => (current === id ? null : current))}
            />
          ))}
        </div>
        <DragOverlay>
          {activeItem ? (
            <SlotItem item={activeItem} dragging readOnly={readOnly || busy} splitArmed={dragMode === "split"} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
