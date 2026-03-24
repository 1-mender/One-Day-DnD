import React from "react";
import ContainerGrid from "./ContainerGrid.jsx";
import { CONTAINERS } from "./inventoryGridDomain.js";

export default function InventorySlotZones({
  rowsByContainer,
  itemBySlot,
  readOnly,
  busy,
  onItemOpen,
  onTransferItem,
  onToggleFavoriteItem,
  onDeleteItem,
  onSplitItem,
  onQuickEquipItem,
  moveItemByKeyboard,
  touchOptimized,
  touchLiteMode,
  tapToMoveMode,
  ultraNarrowScreen,
  itemsCountByContainer,
  selectedMoveId,
  toggleMoveSelection,
  moveSelectedByTap,
  splitArmedId,
  setSplitArmedId,
}) {
  return (
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
  );
}
