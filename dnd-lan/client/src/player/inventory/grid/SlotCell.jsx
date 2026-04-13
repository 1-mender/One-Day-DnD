import { useDroppable } from "@dnd-kit/core";
import React from "react";
import { makeSlotId } from "./inventoryGridDomain.js";
import SlotItem from "./SlotItem.jsx";

export default function SlotCell({
  container,
  slotX,
  slotY,
  item,
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
  onCancelSplitArm
}) {
  const id = makeSlotId(container, slotX, slotY);
  const { isOver, setNodeRef } = useDroppable({ id });
  const tapTargetArmed = tapToMoveMode && selectedMoveId != null;

  return (
    <div
      ref={setNodeRef}
      className={`inv-slot-cell${isOver ? " active" : ""}${item ? " occupied" : ""}${tapTargetArmed ? " tap-target-armed" : ""}${touchLiteMode ? " touch-lite" : ""}`.trim()}
      data-slot={`${container}:${slotX}:${slotY}`}
      onClick={(event) => {
        if (!tapTargetArmed) return;
        if (event.target !== event.currentTarget) return;
        onTapTargetSlot?.({ container, slotX, slotY });
      }}
    >
      {item ? (
        <SlotItem
          item={item}
          readOnly={readOnly}
          onOpen={onItemOpen}
          onEdit={onItemEdit}
          onTransferItem={onTransferItem}
          onToggleFavoriteItem={onToggleFavoriteItem}
          onDeleteItem={onDeleteItem}
          onSplitItem={onSplitItem}
          onQuickEquipItem={onQuickEquipItem}
          onKeyboardMoveItem={onKeyboardMoveItem}
          touchOptimized={touchOptimized}
          touchLiteMode={touchLiteMode}
          tapToMoveMode={tapToMoveMode}
          moveSelectionActive={selectedMoveId != null}
          selectedForMove={selectedMoveId === item.id}
          onToggleMoveSelection={onToggleMoveSelection}
          onTapTargetSlot={onTapTargetSlot}
          splitArmed={splitArmedId === item.id}
          onArmSplit={onArmSplit}
          onCancelSplitArm={onCancelSplitArm}
        />
      ) : (
        <div className="inv-slot-empty" aria-hidden="true" />
      )}
    </div>
  );
}
