import { useDraggable } from "@dnd-kit/core";
import { GripVertical, MoreHorizontal } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { pickInventoryIcon } from "../../../components/vintage/inventoryItemCard/iconDomain.js";
import { isSplittableItem, makeItemId } from "./inventoryGridDomain.js";
import SlotItemMenu from "./SlotItemMenu.jsx";
import { buildTapTargetSlot, getSlotHandleLabel, getSlotItemAvailability } from "./slotItemDomain.js";

export default function SlotItem({
  item,
  readOnly,
  dragging = false,
  onOpen,
  onEdit,
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
  const { qty, reservedQty, availableQty } = getSlotItemAvailability(item);
  const canSplit = isSplittableItem(item);
  const handleLabel = getSlotHandleLabel({ readOnly, tapToMoveMode, selectedForMove });

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
            onTapTargetSlot?.(buildTapTargetSlot(item));
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
          title={handleLabel}
          aria-label={handleLabel}
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
      <SlotItemMenu
        item={item}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        menuRef={menuRef}
        touchOptimized={touchOptimized}
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
      />
    </div>
  );
}
