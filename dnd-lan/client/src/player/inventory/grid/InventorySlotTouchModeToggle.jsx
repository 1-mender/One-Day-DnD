import React from "react";

export default function InventorySlotTouchModeToggle({
  touchOptimized,
  touchLiteMode,
  setTouchLiteMode,
}) {
  if (!touchOptimized) return null;

  return (
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
        Классик.
      </button>
    </div>
  );
}
