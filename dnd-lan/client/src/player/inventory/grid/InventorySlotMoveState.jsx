import React from "react";

export default function InventorySlotMoveState({
  touchOptimized,
  tapToMoveMode,
  selectedMoveItem,
  toggleMoveSelection,
}) {
  if (!(touchOptimized && tapToMoveMode && selectedMoveItem)) return null;

  return (
    <div className="inv-slot-touch-state tf-panel">
      <span>Перемещение: <b>{selectedMoveItem.name || "Без названия"}</b>. Тапните слот назначения.</span>
      <button type="button" className="btn secondary" onClick={() => toggleMoveSelection(selectedMoveItem.id)}>Отмена</button>
    </div>
  );
}
