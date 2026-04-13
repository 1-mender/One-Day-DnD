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
  return (
    <div
      className={`inv-actions ${compact ? "compact" : ""}`.trim()}
      id={actionsId}
      role="group"
      aria-label={actionsLabel}
    >
      {onToggleFavorite ? (
        <button
          type="button"
          className={`btn secondary ${compact ? "icon-btn" : ""}`.trim()}
          onClick={onToggleFavorite}
          disabled={readOnly}
          title={isFavorite ? "Убрать из избранного" : "В избранное"}
          aria-label={isFavorite ? "Убрать из избранного" : "В избранное"}
          aria-pressed={isFavorite ? "true" : "false"}
        >
          {isFavorite ? <StarOff className="icon" aria-hidden="true" /> : <Star className="icon" aria-hidden="true" />}
          {compact ? null : (isFavorite ? "Убрать из избранного" : "В избранное")}
        </button>
      ) : null}
      {onInspect ? (
        <button
          type="button"
          className={`btn secondary ${compact ? "icon-btn" : ""}`.trim()}
          onClick={onInspect}
          title="Осмотреть"
          aria-label="Осмотреть"
        >
          <FileText className="icon" aria-hidden="true" />
          {compact ? null : "Осмотреть"}
        </button>
      ) : null}
      {onEdit ? (
        <button
          type="button"
          className={`btn secondary ${compact ? "icon-btn" : ""}`.trim()}
          onClick={onEdit}
          disabled={readOnly}
          title="Редактировать"
          aria-label="Редактировать"
        >
          <PencilLine className="icon" aria-hidden="true" />
          {compact ? null : "Редактировать"}
        </button>
      ) : null}
      {onTransfer ? (
        <button
          type="button"
          className={`btn secondary ${compact ? "icon-btn" : ""}`.trim()}
          onClick={onTransfer}
          disabled={transferDisabled}
          title={transferDisabled ? "Недоступно для передачи" : "Передать"}
          aria-label="Передать"
        >
          <Send className="icon" aria-hidden="true" />
          {compact ? null : "Передать"}
        </button>
      ) : null}
      {onToggleVisibility ? (
        <button
          type="button"
          className={`btn secondary ${compact ? "icon-btn" : ""}`.trim()}
          onClick={onToggleVisibility}
          disabled={readOnly}
          title={isHidden ? "Сделать публичным" : "Сделать скрытым"}
          aria-label={isHidden ? "Сделать публичным" : "Сделать скрытым"}
        >
          {isHidden ? <Eye className="icon" aria-hidden="true" /> : <EyeOff className="icon" aria-hidden="true" />}
          {compact ? null : (isHidden ? "Сделать публичным" : "Сделать скрытым")}
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          className={`btn danger ${compact ? "icon-btn" : ""}`.trim()}
          onClick={onDelete}
          disabled={readOnly}
          title="Удалить"
          aria-label="Удалить"
        >
          <Trash2 className="icon" aria-hidden="true" />
          {compact ? null : "Удалить"}
        </button>
      ) : null}
    </div>
  );
}
