import React from "react";
import ContainerGridBody from "./ContainerGridBody.jsx";
import ContainerGridSection from "./ContainerGridSection.jsx";
import { getTouchLiteCols } from "./inventoryGridDomain.js";

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
  compactTouch: _compactTouch,
  hasItems,
  selectedMoveId,
  onToggleMoveSelection,
  onTapTargetSlot,
  splitArmedId,
  onArmSplit,
  onCancelSplitArm
}) {
  const visualCols = touchOptimized ? getTouchLiteCols(container.key) : container.cols;
  return (
    <ContainerGridSection
      container={container}
      touchLiteMode={touchLiteMode}
      touchOptimized={touchOptimized}
      hasItems={hasItems}
    >
      <ContainerGridBody
        container={container}
        rows={rows}
        itemBySlot={itemBySlot}
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
        visualCols={visualCols}
      />
    </ContainerGridSection>
  );
}
