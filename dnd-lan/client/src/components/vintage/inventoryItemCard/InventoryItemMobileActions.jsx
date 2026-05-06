import React from "react";
import { Eye, EyeOff, FileText, PencilLine, Send, Star, StarOff, Trash2 } from "lucide-react";
import { ActionSheet } from "../../../foundation/primitives/index.js";

export default function InventoryItemMobileActions({
  itemName,
  quickOpen,
  setQuickOpen,
  readOnly,
  isFavorite,
  isHidden,
  transferDisabled,
  onToggleFavorite,
  onInspect,
  onEdit,
  onTransfer,
  onToggleVisibility,
  onDelete,
}) {
  const actions = [
    {
      show: !!onInspect,
      onClick: () => { onInspect(); setQuickOpen(false); },
      icon: FileText,
      label: "Осмотреть"
    },
    {
      show: !!onToggleFavorite,
      onClick: () => { onToggleFavorite(); setQuickOpen(false); },
      disabled: readOnly,
      icon: isFavorite ? StarOff : Star,
      label: isFavorite ? "Убрать из избранного" : "В избранное",
      ariaPressed: isFavorite
    },
    {
      show: !!onEdit,
      onClick: () => { onEdit(); setQuickOpen(false); },
      disabled: readOnly,
      icon: PencilLine,
      label: "Редактировать"
    },
    {
      show: !!onTransfer,
      onClick: () => { onTransfer(); setQuickOpen(false); },
      disabled: transferDisabled,
      icon: Send,
      label: "Передать"
    },
    {
      show: !!onToggleVisibility,
      onClick: () => { onToggleVisibility(); setQuickOpen(false); },
      disabled: readOnly,
      icon: isHidden ? Eye : EyeOff,
      label: isHidden ? "Сделать публичным" : "Скрыть"
    },
    {
      show: !!onDelete,
      onClick: () => { onDelete(); setQuickOpen(false); },
      disabled: readOnly,
      icon: Trash2,
      label: "Удалить",
      className: "danger"
    }
  ];

  return (
    <ActionSheet
      open={quickOpen}
      title={itemName || "Действия"}
      onClose={() => setQuickOpen(false)}
    >
      <div className="action-sheet-actions">
        {actions.filter(a => a.show).map((action, idx) => {
          const Icon = action.icon;
          return (
            <button
              key={idx}
              type="button"
              className={`action-sheet-item ${action.className || ""}`.trim()}
              onClick={action.onClick}
              disabled={action.disabled}
              aria-pressed={action.ariaPressed !== undefined ? (action.ariaPressed ? "true" : "false") : undefined}
            >
              <Icon className="icon" aria-hidden="true" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </ActionSheet>
  );
}
