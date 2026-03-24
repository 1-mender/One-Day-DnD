import React from "react";
import { GripVertical, MoreHorizontal } from "lucide-react";

export default function InventorySlotBoardHint({
  touchOptimized,
  tapToMoveMode,
}) {
  return (
    <div className="small inv-slot-hint tf-slot-hint">
      {touchOptimized && tapToMoveMode ? (
        <>Lite: выберите предмет кнопкой <GripVertical className="icon" aria-hidden="true" />, затем тапните слот.</>
      ) : touchOptimized ? (
        <>Классика: перетаскивайте предмет за <GripVertical className="icon" aria-hidden="true" />.</>
      ) : (
        <>RPG-сетка: перетаскивайте за <GripVertical className="icon" aria-hidden="true" />, контекст через <MoreHorizontal className="icon" aria-hidden="true" />, клавиатура: Alt + стрелки.</>
      )}
    </div>
  );
}
