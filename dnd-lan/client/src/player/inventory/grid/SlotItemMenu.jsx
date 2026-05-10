import React from "react";
import { ActionSheet } from "../../../foundation/primitives/index.js";

function SlotItemMenuActions({
  item,
  readOnly,
  availableQty,
  canSplit,
  onOpen,
  onEdit,
  onQuickEquipItem,
  onTransferItem,
  onSplitItem,
  onToggleFavoriteItem,
  onDeleteItem,
  closeMenu,
  mobile = false,
}) {
  const itemClass = mobile ? "action-sheet-item" : undefined;
  return (
    <>
      <button type="button" className={itemClass} onClick={() => { onOpen?.(item); closeMenu(); }}>
        <span>Осмотреть</span>
      </button>
      {onEdit ? (
        <button type="button" className={itemClass} onClick={() => { if (readOnly) return; onEdit?.(item); closeMenu(); }} disabled={readOnly}>
          <span>Редактировать</span>
        </button>
      ) : null}
      <button type="button" className={itemClass} onClick={() => { onQuickEquipItem?.(item); closeMenu(); }} disabled={readOnly}>
        <span>Быстро экипировать</span>
      </button>
      <button type="button" className={itemClass} onClick={() => { onTransferItem?.(item); closeMenu(); }} disabled={readOnly || availableQty <= 0}>
        <span>Передать</span>
      </button>
      <button type="button" className={itemClass} onClick={() => { onSplitItem?.(item); closeMenu(); }} disabled={readOnly || !canSplit}>
        <span>Разделить стак</span>
      </button>
      <button type="button" className={itemClass} onClick={() => { onToggleFavoriteItem?.(item); closeMenu(); }} disabled={readOnly}>
        <span>Избранное</span>
      </button>
      <button type="button" className={`${itemClass || ""} danger`.trim()} onClick={() => { onDeleteItem?.(item); closeMenu(); }} disabled={readOnly}>
        <span>Удалить</span>
      </button>
    </>
  );
}

export default function SlotItemMenu({
  item,
  menuOpen,
  setMenuOpen,
  menuRef,
  touchOptimized,
  readOnly,
  availableQty,
  canSplit,
  onOpen,
  onEdit,
  onQuickEquipItem,
  onTransferItem,
  onSplitItem,
  onToggleFavoriteItem,
  onDeleteItem,
}) {
  if (!menuOpen) return null;

  if (touchOptimized) {
    return (
      <ActionSheet open={menuOpen} title={item.name || "Действия"} onClose={() => setMenuOpen(false)}>
        <div className="action-sheet-actions">
          <SlotItemMenuActions
            item={item}
            readOnly={readOnly}
            availableQty={availableQty}
            canSplit={canSplit}
            onOpen={onOpen}
            onEdit={onEdit}
            onQuickEquipItem={onQuickEquipItem}
            onTransferItem={onTransferItem}
            onSplitItem={onSplitItem}
            onToggleFavoriteItem={onToggleFavoriteItem}
            onDeleteItem={onDeleteItem}
            closeMenu={() => setMenuOpen(false)}
            mobile
          />
        </div>
      </ActionSheet>
    );
  }

  return (
    <div
      className="inv-slot-menu"
      ref={menuRef}
      role="menu"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const menu = menuRef.current;
        const focusable = menu
          ? Array.from(menu.querySelectorAll("button:not(:disabled)"))
          : [];
        if (!focusable.length) {
          setMenuOpen(false);
          return;
        }
        const currentIndex = focusable.indexOf(document.activeElement);
        const nextIndex = event.shiftKey
          ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
          : (currentIndex < 0 || currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1);
        event.preventDefault();
        focusable[nextIndex]?.focus();
      }}
    >
      <SlotItemMenuActions
        item={item}
        readOnly={readOnly}
        availableQty={availableQty}
        canSplit={canSplit}
        onOpen={onOpen}
        onEdit={onEdit}
        onQuickEquipItem={onQuickEquipItem}
        onTransferItem={onTransferItem}
        onSplitItem={onSplitItem}
        onToggleFavoriteItem={onToggleFavoriteItem}
        onDeleteItem={onDeleteItem}
        closeMenu={() => setMenuOpen(false)}
      />
    </div>
  );
}
