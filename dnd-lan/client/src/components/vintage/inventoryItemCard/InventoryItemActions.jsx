import React from "react";
import { Eye, EyeOff, FileText, PencilLine, Send, Star, StarOff, Trash2 } from "lucide-react";

export default function InventoryItemActions({
  actionsId,
  actionsLabel,
  compact,
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
      onClick: onInspect,
      icon: FileText,
      label: "Осмотреть",
      className: "secondary",
    },
    {
      show: !!onToggleFavorite,
      onClick: onToggleFavorite,
      disabled: readOnly,
      icon: isFavorite ? StarOff : Star,
      label: isFavorite ? "Убрать из избранного" : "В избранное",
      className: "secondary",
      ariaPressed: isFavorite,
    },
    {
      show: !!onEdit,
      onClick: onEdit,
      disabled: readOnly,
      icon: PencilLine,
      label: "Редактировать",
      className: "secondary",
    },
    {
      show: !!onTransfer,
      onClick: onTransfer,
      disabled: transferDisabled,
      icon: Send,
      label: transferDisabled ? "Недоступно для передачи" : "Передать",
      className: "secondary",
    },
    {
      show: !!onToggleVisibility,
      onClick: onToggleVisibility,
      disabled: readOnly,
      icon: isHidden ? Eye : EyeOff,
      label: isHidden ? "Сделать публичным" : "Сделать скрытым",
      className: "secondary",
    },
    {
      show: !!onDelete,
      onClick: onDelete,
      disabled: readOnly,
      icon: Trash2,
      label: "Удалить",
      className: "danger",
    },
  ];

  return (
    <div
      className={`inv-actions ${compact ? "compact" : ""}`.trim()}
      id={actionsId}
      role="group"
      aria-label={actionsLabel}
    >
      {actions.filter(a => a.show).map((action, idx) => {
        const Icon = action.icon;
        return (
          <button
            key={idx}
            type="button"
            className={`btn ${action.className} ${compact ? "icon-btn" : ""}`.trim()}
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.label}
            aria-label={action.label}
            aria-pressed={action.ariaPressed !== undefined ? (action.ariaPressed ? "true" : "false") : undefined}
          >
            <Icon className="icon" aria-hidden="true" />
            {!compact && action.label}
          </button>
        );
      })}
    </div>
  );
}
