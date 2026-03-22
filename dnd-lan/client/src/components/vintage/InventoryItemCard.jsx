import React, { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Axe,
  Backpack,
  BowArrow,
  BookOpen,
  Crown,
  Eye,
  EyeOff,
  Star,
  StarOff,
  FlaskConical,
  Gem,
  Key,
  PencilLine,
  PocketKnife,
  ScrollText,
  Send,
  Shield,
  Skull,
  Sword,
  Trash2,
  Wand
} from "lucide-react";
import { getIconKeyFromItem, getInventoryIcon, stripIconTags } from "../../lib/inventoryIcons.js";
import { getRarityLabel } from "../../lib/inventoryRarity.js";
import MarkdownView from "../markdown/MarkdownView.jsx";
import RarityBadge from "./RarityBadge.jsx";
import ActionSheet from "../ui/ActionSheet.jsx";

let swipeHintShown = false;

const TAG_ICON_RULES = [
  { icon: Sword, match: ["weapon", "sword", "blade", "меч", "клин", "оруж"] },
  { icon: BowArrow, match: ["bow", "лук", "arrows", "ranged"] },
  { icon: Axe, match: ["axe", "топор"] },
  { icon: PocketKnife, match: ["dagger", "knife", "кинжал", "нож"] },
  { icon: Shield, match: ["shield", "armor", "armour", "брон", "щит", "доспех"] },
  { icon: Wand, match: ["wand", "staff", "посох", "жезл"] },
  { icon: ScrollText, match: ["scroll", "свиток"] },
  { icon: BookOpen, match: ["book", "tome", "grimoire", "книга", "том"] },
  { icon: FlaskConical, match: ["potion", "elixir", "flask", "зель", "эликс"] },
  { icon: Gem, match: ["gem", "jewel", "ring", "amulet", "камень", "самоцвет", "амулет", "кольц"] },
  { icon: Crown, match: ["crown", "legendary", "релик", "артефакт"] },
  { icon: Key, match: ["key", "ключ"] },
  { icon: Skull, match: ["necromancy", "skull", "curse", "проклят", "череп"] },
  { icon: Backpack, match: ["bag", "backpack", "рюк", "сумк", "pack"] }
];

function pickFallbackText(tokens) {
  const tags = tokens.map((t) => String(t).toLowerCase());
  if (tags.some((t) => t.includes("weapon") || t.includes("меч") || t.includes("лук"))) return "МЕЧ";
  if (tags.some((t) => t.includes("armor") || t.includes("брон") || t.includes("shield") || t.includes("щит"))) return "БРОНЯ";
  if (tags.some((t) => t.includes("potion") || t.includes("зель") || t.includes("elixir"))) return "ЗЕЛЬЕ";
  if (tags.some((t) => t.includes("scroll") || t.includes("свит"))) return "СВИТОК";
  if (tags.some((t) => t.includes("book") || t.includes("книга"))) return "КНИГА";
  if (tags.some((t) => t.includes("ring") || t.includes("amulet") || t.includes("камень"))) return "АРТЕФ";
  return "ПРЕДМ";
}

export function pickInventoryIcon(item) {
  const iconKey = getIconKeyFromItem(item);
  const CustomIcon = getInventoryIcon(iconKey);
  if (CustomIcon) return { Icon: CustomIcon };
  const tokens = [
    item.name,
    item.type,
    item.category,
    ...stripIconTags(Array.isArray(item.tags) ? item.tags : [])
  ].filter(Boolean).map((t) => String(t).toLowerCase());
  const hay = tokens.join(" ");
  const rule = TAG_ICON_RULES.find((r) => r.match.some((m) => hay.includes(m)));
  if (rule?.icon) return { Icon: rule.icon };
  return { text: pickFallbackText(tokens) };
}

function toPlainText(value) {
  return String(value || "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[`*_>#~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, max = 160) {
  if (!value) return "";
  if (value.length <= max) return value;
  const end = Math.max(0, max - 3);
  return `${value.slice(0, end).trim()}...`;
}

function InventoryItemCard({
  item,
  readOnly,
  onEdit,
  onDelete,
  onToggleVisibility,
  onToggleFavorite,
  actionsVariant = "stack",
  lite = false,
  selectable = false,
  selected = false,
  onSelectChange,
  onTransfer
}) {
  const actionsId = useId();
  const descId = useId();
  const icon = pickInventoryIcon(item);
  const isHidden = item.visibility === "hidden";
  const vis = isHidden ? "Скрытый" : "Публичный";
  const hasActions = !!onEdit || !!onDelete || !!onToggleVisibility || !!onToggleFavorite || !!onTransfer;
  const weight = Number(item.weight || 0);
  const rarityKey = String(item.rarity || "common").toLowerCase().replace(/\s+/g, "_");
  const rarityLabel = getRarityLabel(rarityKey);
  const tags = stripIconTags(Array.isArray(item.tags) ? item.tags.filter(Boolean) : []);
  const isFavorite = tags.includes("favorite");
  const compact = actionsVariant === "compact";
  const reservedQty = Number(item.reservedQty ?? item.reserved_qty ?? 0);
  const totalQty = Number(item.qty || 0);
  const availableQty = Math.max(0, totalQty - reservedQty);
  const transferDisabled = readOnly || availableQty <= 0;
  const [quickOpen, setQuickOpen] = useState(false);
  const longPressTimerRef = useRef(null);
  const pressStartRef = useRef({ x: 0, y: 0 });
  const swipeRef = useRef({ active: false, pointerId: null, startX: 0, startY: 0, swiping: false });
  const isMobile = useIsMobile();
  const SWIPE_START_PX = 16;
  const SWIPE_ACTION_PX = 56;
  const SWIPE_CANCEL_PX = 20;
  const [showHint, setShowHint] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const descPlain = useMemo(() => toPlainText(item.description), [item.description]);
  const descPreview = useMemo(() => truncateText(descPlain, 180), [descPlain]);
  const hasLongDesc = !lite && descPlain.length > 180;
  const showFullDesc = !lite && (!hasLongDesc || expanded);
  const showActions = hasActions && (!isMobile && (!(compact || lite) || quickOpen));
  const swipeEnabled = isMobile && hasActions;
  const actionsLabel = item.name ? `Действия: ${item.name}` : "Действия предмета";

  useEffect(() => {
    setQuickOpen(false);
  }, [item.id]);

  useEffect(() => {
    if (!swipeEnabled || swipeHintShown || typeof window === "undefined") return;
    try {
      const seen = window.localStorage?.getItem("invSwipeHintSeen");
      if (seen) {
        swipeHintShown = true;
        return;
      }
      swipeHintShown = true;
      setShowHint(true);
      const timer = setTimeout(() => setShowHint(false), 1600);
      window.localStorage?.setItem("invSwipeHintSeen", "1");
      return () => clearTimeout(timer);
    } catch {
      swipeHintShown = true;
      setShowHint(true);
      const timer = setTimeout(() => setShowHint(false), 1600);
      return () => clearTimeout(timer);
    }
  }, [swipeEnabled]);

  const hapticTap = (duration = 10) => {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(duration);
      }
    } catch {
      // ignore
    }
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const clearSwipe = () => {
    swipeRef.current = { active: false, pointerId: null, startX: 0, startY: 0, swiping: false };
  };

  const isInteractiveTarget = (target) => {
    if (!target || typeof target.closest !== "function") return false;
    return !!target.closest("button, a, input, select, textarea, details, summary, label");
  };

  const handlePointerDown = (event) => {
    if (isInteractiveTarget(event.target)) return;
    const isTouch = event.pointerType === "touch";
    if (!isTouch) return;
    if (event.currentTarget?.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    clearLongPress();
    pressStartRef.current = { x: event.clientX, y: event.clientY };
    longPressTimerRef.current = setTimeout(() => {
      setQuickOpen(true);
      hapticTap(8);
    }, 420);
    swipeRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      swiping: false
    };
  };

  const handlePointerMove = (event) => {
    const swipe = swipeRef.current;
    if (!swipe.active || swipe.pointerId !== event.pointerId) return;
    const dx = event.clientX - swipe.startX;
    const dy = event.clientY - swipe.startY;
    if (!swipe.swiping) {
      if (Math.abs(dx) > SWIPE_START_PX && Math.abs(dx) > Math.abs(dy)) {
        swipe.swiping = true;
        clearLongPress();
      } else if (Math.abs(dy) > SWIPE_CANCEL_PX) {
        clearSwipe();
      }
    }
  };

  const handlePointerEnd = (event) => {
    const swipe = swipeRef.current;
    if (!swipe.active || swipe.pointerId !== event.pointerId) {
      clearLongPress();
      return;
    }
    const dx = event.clientX - swipe.startX;
    const dy = event.clientY - swipe.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX > SWIPE_ACTION_PX && absX > absY * 1.2) {
      if (dx < 0 && hasActions) {
        setQuickOpen(true);
        hapticTap(8);
      } else if (dx > 0 && onToggleFavorite && !readOnly) {
        onToggleFavorite();
        hapticTap(6);
      }
    }
    clearSwipe();
    clearLongPress();
  };

  useEffect(() => () => clearLongPress(), []);

  return (
    <div
      className="item taped inv-card tf-item-card"
      data-rarity={rarityKey}
      data-visibility={item.visibility}
      data-favorite={isFavorite ? "true" : "false"}
      data-selected={selected ? "true" : "false"}
      data-actions-open={quickOpen ? "true" : "false"}
      data-swipe-hint={showHint ? "true" : "false"}
      data-variant={actionsVariant}
      data-lite={lite ? "true" : "false"}
      style={{ contentVisibility: "auto", containIntrinsicSize: "180px" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      onContextMenu={(event) => {
        if (!hasActions) return;
        event.preventDefault();
        setQuickOpen((prev) => !prev);
      }}
    >
      {selectable ? (
        <label className="inv-select">
          <input
            type="checkbox"
            checked={!!selected}
            onChange={(e) => onSelectChange?.(e.target.checked)}
            aria-label={"\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u043f\u0440\u0435\u0434\u043c\u0435\u0442"}
            disabled={readOnly}
          />
        </label>
      ) : null}
      <div className="inv-card-header">
        <div className="inv-icon-wrap" aria-hidden="true">
          {icon.Icon ? (
            <icon.Icon className="inv-icon" aria-hidden="true" />
          ) : (
            <div className="inv-fallback">{icon.text}</div>
          )}
        </div>
        <div className="inv-body">
          <div className="inv-title-row">
            <div className="inv-title">{item.name || "Без названия"}</div>
            <div className="inv-title-right">
              <RarityBadge rarity={rarityKey} />
              {hasActions ? (
                <button
                  type="button"
                  className={`inv-quick-toggle${quickOpen ? " active" : ""}`}
                  onClick={() => {
                    setQuickOpen((prev) => {
                      const next = !prev;
                      if (next) hapticTap(6);
                      return next;
                    });
                  }}
                  aria-expanded={quickOpen ? "true" : "false"}
                  aria-controls={showActions ? actionsId : undefined}
                  aria-label="Быстрые действия"
                  title="Быстрые действия"
                >
                  <span className="inv-quick-dots" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="inv-meta-row">
            <span className="inv-chip">x{item.qty}</span>
            <span className={`inv-chip ${isHidden ? "off" : "ok"}`}>
              {isHidden ? <EyeOff className="icon" aria-hidden="true" /> : <Eye className="icon" aria-hidden="true" />}{vis}
            </span>
            <span className="inv-chip">Вес: {weight.toFixed(2)}</span>
            <span className="inv-chip secondary">Редкость: {rarityLabel}</span>
            {reservedQty > 0 ? (
              <span className="inv-chip warn" title={`В резерве: ${reservedQty}`} aria-label={`В резерве: ${reservedQty}`}>
                Доступно: {availableQty}
              </span>
            ) : null}
          </div>
          {!lite && tags.length ? (
            <div className="inv-tags">
              {tags.slice(0, 4).map((tag) => (
                <span key={tag} className="inv-tag">#{tag}</span>
              ))}
            </div>
          ) : null}
          {item.updated_by === "dm" ? (
            <div className="inv-note small">изменено DM</div>
          ) : null}
        </div>
      </div>

      {item.description ? (
        <div className={`inv-desc${lite ? " inv-desc-lite" : ""}`.trim()}>
          <div className="inv-desc-text" id={descId}>
            {showFullDesc ? (
              <MarkdownView source={item.description} />
            ) : (
              descPreview
            )}
          </div>
          {!lite && hasLongDesc ? (
            <button
              type="button"
              className="inv-desc-toggle"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded ? "true" : "false"}
              aria-controls={descId}
            >
              {expanded ? "Скрыть" : "Подробнее"}
            </button>
          ) : null}
        </div>
      ) : null}

      {showActions ? (
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
          {onEdit && (
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
          )}
          {onTransfer && (
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
          )}
          {onToggleVisibility && (
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
          )}
          {onDelete && (
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
          )}
        </div>
      ) : null}
      {isMobile && hasActions ? (
        <ActionSheet
          open={quickOpen}
          title={item.name || "Действия"}
          onClose={() => setQuickOpen(false)}
        >
          <div className="action-sheet-actions">
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
      ) : null}
    </div>
  );
}

export default memo(InventoryItemCard);

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 720px)");
    const update = () => setIsMobile(!!mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else if (mq.addListener) mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else if (mq.removeListener) mq.removeListener(update);
    };
  }, []);
  return isMobile;
}





