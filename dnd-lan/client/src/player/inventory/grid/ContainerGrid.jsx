import React from "react";
import { getTouchLiteCols, makeSlotKey } from "./inventoryGridDomain.js";
import SlotCell from "./SlotCell.jsx";

export default function ContainerGrid({
  container,
  rows,
  itemBySlot,
  readOnly,
  onItemOpen,
  onTransferItem,
  onToggleFavoriteItem,
  onDeleteItem,
  onSplitItem,
  onQuickEquipItem,
  onKeyboardMoveItem,
  touchOptimized,
  touchLiteMode,
  tapToMoveMode,
  compactTouch,
  hasItems,
  selectedMoveId,
  onToggleMoveSelection,
  onTapTargetSlot,
  splitArmedId,
  onArmSplit,
  onCancelSplitArm
}) {
  const displayCols = touchLiteMode ? getTouchLiteCols(container.key) : container.cols;
  const minCell = touchLiteMode ? (compactTouch ? 0 : 86) : touchOptimized ? (compactTouch ? 0 : 76) : 0;
  const gridMinWidth = touchOptimized && minCell > 0 ? (displayCols * minCell + (displayCols - 1) * 10) : null;
  const gridNode = (
    <div
      className="inv-slot-grid"
      style={{
        gridTemplateColumns: touchOptimized && minCell > 0
          ? `repeat(${displayCols}, minmax(${minCell}px, 1fr))`
          : `repeat(${touchOptimized ? displayCols : container.cols}, minmax(0, 1fr))`,
        minWidth: gridMinWidth ? `${gridMinWidth}px` : undefined
      }}
    >
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
            onQuickEquipItem={onQuickEquipItem}
            onKeyboardMoveItem={onKeyboardMoveItem}
            touchOptimized={touchOptimized}
            touchLiteMode={touchLiteMode}
            tapToMoveMode={tapToMoveMode}
            selectedMoveId={selectedMoveId}
            onToggleMoveSelection={onToggleMoveSelection}
            onTapTargetSlot={onTapTargetSlot}
            splitArmedId={splitArmedId}
            onArmSplit={onArmSplit}
            onCancelSplitArm={onCancelSplitArm}
          />
        );
      })}
    </div>
  );

  if (touchLiteMode && container.key !== "backpack") {
    return (
      <details className="inv-slot-zone tf-slot-zone touch-collapsed" open={hasItems}>
        <summary className="inv-slot-zone-head">
          <h4>{container.label}</h4>
          <span className="badge secondary">{hasItems ? "есть предметы" : "пусто"}</span>
        </summary>
        {gridNode}
      </details>
    );
  }

  return (
    <section className={`inv-slot-zone tf-slot-zone${touchOptimized ? " touch-optimized" : ""}`.trim()}>
      <div className="inv-slot-zone-head">
        <h4>{container.label}</h4>
      </div>
      {gridNode}
    </section>
  );
}
