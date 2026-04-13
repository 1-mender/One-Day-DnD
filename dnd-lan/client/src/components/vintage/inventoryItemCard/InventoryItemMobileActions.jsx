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
  return (
    <ActionSheet
      open={quickOpen}
      title={itemName || "Действия"}
      onClose={() => setQuickOpen(false)}
    >
      <div className="action-sheet-actions">
        {onInspect ? (
          <button
            type="button"
            className="action-sheet-item"
            onClick={() => {
              onInspect?.();
              setQuickOpen(false);
            }}
          >
            <FileText className="icon" aria-hidden="true" />
            <span>Осмотреть</span>
          </button>
        ) : null}
        {onToggleFavorite ? (
          <button
            type="button"
            className="action-sheet-item"
            onClick={() => {
              if (readOnly) return;
              onToggleFavorite();
              setQuickOpen(false);
            }}
            disabled={readOnly}
            aria-pressed={isFavorite ? "true" : "false"}
          >
            {isFavorite ? <StarOff className="icon" aria-hidden="true" /> : <Star className="icon" aria-hidden="true" />}
            <span>{isFavorite ? "Убрать из избранного" : "В избранное"}</span>
          </button>
        ) : null}
        {onEdit ? (
          <button
            type="button"
            className="action-sheet-item"
            onClick={() => {
              if (readOnly) return;
              onEdit();
              setQuickOpen(false);
            }}
            disabled={readOnly}
          >
            <PencilLine className="icon" aria-hidden="true" />
            <span>Редактировать</span>
          </button>
        ) : null}
        {onTransfer ? (
          <button
            type="button"
            className="action-sheet-item"
            onClick={() => {
              if (transferDisabled) return;
              onTransfer();
              setQuickOpen(false);
            }}
            disabled={transferDisabled}
          >
            <Send className="icon" aria-hidden="true" />
            <span>Передать</span>
          </button>
        ) : null}
        {onToggleVisibility ? (
          <button
            type="button"
            className="action-sheet-item"
            onClick={() => {
              if (readOnly) return;
              onToggleVisibility();
              setQuickOpen(false);
            }}
            disabled={readOnly}
          >
            {isHidden ? <Eye className="icon" aria-hidden="true" /> : <EyeOff className="icon" aria-hidden="true" />}
            <span>{isHidden ? "Сделать публичным" : "Скрыть"}</span>
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            className="action-sheet-item danger"
            onClick={() => {
              if (readOnly) return;
              onDelete();
              setQuickOpen(false);
            }}
            disabled={readOnly}
          >
            <Trash2 className="icon" aria-hidden="true" />
            <span>Удалить</span>
          </button>
        ) : null}
      </div>
    </ActionSheet>
  );
}
