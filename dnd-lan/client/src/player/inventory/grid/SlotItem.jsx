import { useDraggable } from "@dnd-kit/core";
import { GripVertical, MoreHorizontal } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import ActionSheet from "../../../components/ui/ActionSheet.jsx";
import { pickInventoryIcon } from "../../../components/vintage/InventoryItemCard.jsx";
import { isSplittableItem, makeItemId, normalizeContainer } from "./inventoryGridDomain.js";

export default function SlotItem({
  item,
  readOnly,
  dragging = false,
  onOpen,
  onTransferItem,
  onToggleFavoriteItem,
  onDeleteItem,
  onSplitItem,
  onQuickEquipItem,
  onKeyboardMoveItem,
  touchOptimized = false,
  touchLiteMode = false,
  tapToMoveMode = false,
  moveSelectionActive = false,
  selectedForMove = false,
  onToggleMoveSelection,
  onTapTargetSlot,
  splitArmed = false,
  onArmSplit,
  onCancelSplitArm
}) {
  const draggableId = makeItemId(item.id);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    disabled: readOnly || tapToMoveMode
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const menuBtnRef = useRef(null);
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const icon = pickInventoryIcon(item);
  const qty = Math.max(1, Number(item.qty) || 1);
  const reservedQty = Math.max(0, Number(item.reservedQty ?? item.reserved_qty) || 0);
  const availableQty = Math.max(0, qty - reservedQty);
  const canSplit = isSplittableItem(item);

  const clearSplitTimer = (target) => {
    const timer = Number(target?.dataset?.splitTimer || 0);
    if (timer) clearTimeout(timer);
    if (target?.dataset) delete target.dataset.splitTimer;
  };

  useEffect(() => {
    if (!menuOpen || touchOptimized) return () => {};
    const onPointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      if (menuBtnRef.current?.contains(event.target)) return;
      setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenuOpen(false);
      menuBtnRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => {
      const first = menuRef.current?.querySelector("button:not(:disabled)");
      first?.focus();
    });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, touchOptimized]);

  return (
    <div
      ref={setNodeRef}
      className={`inv-slot-item${isDragging || dragging ? " dragging" : ""}${selectedForMove ? " selected-for-move" : ""}${touchLiteMode ? " touch-lite" : ""}${touchOptimized ? " touch-optimized" : ""}`.trim()}
      style={style}
      aria-label={`${item.name || "Предмет"} x${qty}`}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen((prev) => !prev);
      }}
    >
      <button
        type="button"
        className="inv-slot-open"
        onClick={() => {
          if (tapToMoveMode && selectedForMove) {
            onToggleMoveSelection?.(item.id);
            return;
          }
          if (tapToMoveMode && moveSelectionActive) {
            onTapTargetSlot?.({
              container: normalizeContainer(item.container),
              slotX: Number(item.slotX),
              slotY: Number(item.slotY)
            });
            return;
          }
          onOpen?.(item);
        }}
        title={`${item.name || "Предмет"} x${qty}`}
        onKeyDown={(event) => {
          if (!event.altKey) return;
          let deltaX = 0;
          let deltaY = 0;
          if (event.key === "ArrowLeft") deltaX = -1;
          else if (event.key === "ArrowRight") deltaX = 1;
          else if (event.key === "ArrowUp") deltaY = -1;
          else if (event.key === "ArrowDown") deltaY = 1;
          else return;
          event.preventDefault();
          const maybePromise = onKeyboardMoveItem?.(item, deltaX, deltaY);
          if (maybePromise && typeof maybePromise.catch === "function") maybePromise.catch(() => {});
        }}
      >
        {icon.Icon ? (
          <icon.Icon className="inv-slot-icon" aria-hidden="true" />
        ) : (
          <span className="inv-slot-fallback">{icon.text}</span>
        )}
        <span className="inv-slot-name">{item.name || "Без названия"}</span>
      </button>
      <div className="inv-slot-meta">
        <span className="inv-slot-qty">x{qty}</span>
        {reservedQty > 0 ? <span className="inv-slot-reserved">{availableQty}</span> : null}
      </div>
      <div className="inv-slot-actions">
        <button
          type="button"
          className={`inv-slot-handle${splitArmed ? " split-armed" : ""}`.trim()}
          disabled={readOnly}
          title={
            readOnly
              ? "Недоступно в режиме только чтения"
              : tapToMoveMode
                ? (selectedForMove ? "Отменить выбор предмета" : "Выбрать предмет для перемещения")
                : "Перетащить предмет"
          }
          aria-label={
            readOnly
              ? "Недоступно в режиме только чтения"
              : tapToMoveMode
                ? (selectedForMove ? "Отменить выбор предмета" : "Выбрать предмет для перемещения")
                : "Перетащить предмет"
          }
          onClick={(event) => {
            if (!tapToMoveMode) return;
            event.preventDefault();
            event.stopPropagation();
            onToggleMoveSelection?.(item.id);
          }}
          onPointerDownCapture={(event) => {
            if (touchOptimized || readOnly || !canSplit || event.button === 2) return;
            clearSplitTimer(event.currentTarget);
            const timer = setTimeout(() => {
              onArmSplit?.(item.id);
            }, 360);
            event.currentTarget.dataset.splitTimer = String(timer);
          }}
          onPointerUpCapture={(event) => {
            if (touchOptimized) return;
            clearSplitTimer(event.currentTarget);
          }}
          onPointerCancelCapture={(event) => {
            if (touchOptimized) return;
            clearSplitTimer(event.currentTarget);
            onCancelSplitArm?.(item.id);
          }}
          {...(!tapToMoveMode ? attributes : {})}
          {...(!tapToMoveMode ? listeners : {})}
        >
          <GripVertical className="icon" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="inv-slot-menu-btn"
          ref={menuBtnRef}
          onClick={() => setMenuOpen((prev) => !prev)}
          title="Контекст"
          aria-label="Контекст"
          aria-haspopup="menu"
          aria-expanded={menuOpen ? "true" : "false"}
        >
          <MoreHorizontal className="icon" aria-hidden="true" />
        </button>
      </div>
      {menuOpen && !touchOptimized ? (
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
          <button type="button" onClick={() => { onOpen?.(item); setMenuOpen(false); }}>Редактировать</button>
          <button type="button" onClick={() => { onQuickEquipItem?.(item); setMenuOpen(false); }} disabled={readOnly}>Быстро экипировать</button>
          <button type="button" onClick={() => { onTransferItem?.(item); setMenuOpen(false); }} disabled={readOnly || availableQty <= 0}>Передать</button>
          <button type="button" onClick={() => { onSplitItem?.(item); setMenuOpen(false); }} disabled={readOnly || !canSplit}>Разделить стак</button>
          <button type="button" onClick={() => { onToggleFavoriteItem?.(item); setMenuOpen(false); }} disabled={readOnly}>Избранное</button>
          <button type="button" className="danger" onClick={() => { onDeleteItem?.(item); setMenuOpen(false); }} disabled={readOnly}>Удалить</button>
        </div>
      ) : null}
      {touchOptimized ? (
        <ActionSheet open={menuOpen} title={item.name || "Действия"} onClose={() => setMenuOpen(false)}>
          <div className="action-sheet-actions">
            <button type="button" className="action-sheet-item" onClick={() => { onOpen?.(item); setMenuOpen(false); }}>
              <span>Редактировать</span>
            </button>
            <button type="button" className="action-sheet-item" onClick={() => { onQuickEquipItem?.(item); setMenuOpen(false); }} disabled={readOnly}>
              <span>Быстро экипировать</span>
            </button>
            <button type="button" className="action-sheet-item" onClick={() => { onTransferItem?.(item); setMenuOpen(false); }} disabled={readOnly || availableQty <= 0}>
              <span>Передать</span>
            </button>
            <button type="button" className="action-sheet-item" onClick={() => { onSplitItem?.(item); setMenuOpen(false); }} disabled={readOnly || !canSplit}>
              <span>Разделить стак</span>
            </button>
            <button type="button" className="action-sheet-item" onClick={() => { onToggleFavoriteItem?.(item); setMenuOpen(false); }} disabled={readOnly}>
              <span>Избранное</span>
            </button>
            <button type="button" className="action-sheet-item danger" onClick={() => { onDeleteItem?.(item); setMenuOpen(false); }} disabled={readOnly}>
              <span>Удалить</span>
            </button>
          </div>
        </ActionSheet>
      ) : null}
    </div>
  );
}
