import React from "react";
import { makeSlotKey } from "./inventoryGridDomain.js";
import SlotCell from "./SlotCell.jsx";

export default function ContainerGridBody({
  container,
  rows,
  itemBySlot,
  readOnly,
  onItemOpen,
  onItemEdit,
  onTransferItem,
  onToggleFavoriteItem,
  onDeleteItem,
  onSplitItem,
  onQuickEquipItem,
  onKeyboardMoveItem,
  touchOptimized,
  touchLiteMode,
  tapToMoveMode,
  selectedMoveId,
  onToggleMoveSelection,
  onTapTargetSlot,
  splitArmedId,
  onArmSplit,
  onCancelSplitArm,
  visualCols,
}) {
  return (
    <div
      className="inv-slot-grid"
      style={{
        gridTemplateColumns: `repeat(${visualCols}, minmax(0, 1fr))`
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
            onItemEdit={onItemEdit}
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
}
