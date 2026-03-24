import React, { memo, useId, useMemo, useState } from "react";
import {
  Axe,
  Backpack,
  BowArrow,
  BookOpen,
  Crown,
  Eye,
  EyeOff,
  FlaskConical,
  Gem,
  Key,
  PocketKnife,
  ScrollText,
  Shield,
  Skull,
  Sword,
  Wand
} from "lucide-react";
import { getIconKeyFromItem, getInventoryIcon, stripIconTags } from "../../lib/inventoryIcons.js";
import { getRarityLabel } from "../../lib/inventoryRarity.js";
import MarkdownView from "../markdown/MarkdownView.jsx";
import RarityBadge from "./RarityBadge.jsx";
import InventoryItemActions from "./inventoryItemCard/InventoryItemActions.jsx";
import InventoryItemMobileActions from "./inventoryItemCard/InventoryItemMobileActions.jsx";
import { useInventoryItemInteractions } from "./inventoryItemCard/useInventoryItemInteractions.js";

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
  const [expanded, setExpanded] = useState(false);
  const {
    isMobile,
    quickOpen,
    setQuickOpen,
    showHint,
    hapticTap,
    interactionHandlers,
  } = useInventoryItemInteractions({
    itemId: item.id,
    hasActions,
    onToggleFavorite,
    readOnly,
  });
  const descPlain = useMemo(() => toPlainText(item.description), [item.description]);
  const descPreview = useMemo(() => truncateText(descPlain, 180), [descPlain]);
  const hasLongDesc = !lite && descPlain.length > 180;
  const showFullDesc = !lite && (!hasLongDesc || expanded);
  const showDesc = !!item.description && descPlain.length > (isMobile ? 6 : 0);
  const showActions = hasActions && (!isMobile && (!(compact || lite) || quickOpen));
  const actionsLabel = item.name ? `Действия: ${item.name}` : "Действия предмета";

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
      {...interactionHandlers}
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
          <div className={`inv-meta-row${isMobile ? " inv-meta-row-mobile" : ""}`.trim()}>
            <span className="inv-chip">x{item.qty}</span>
            <span className={`inv-chip ${isHidden ? "off" : "ok"}`}>
              {isHidden ? <EyeOff className="icon" aria-hidden="true" /> : <Eye className="icon" aria-hidden="true" />}{vis}
            </span>
            <span className="inv-chip">Вес: {weight.toFixed(2)}</span>
            {!isMobile ? <span className="inv-chip secondary">Редкость: {rarityLabel}</span> : null}
            {reservedQty > 0 ? (
              <span className="inv-chip warn" title={`В резерве: ${reservedQty}`} aria-label={`В резерве: ${reservedQty}`}>
                Доступно: {availableQty}
              </span>
            ) : null}
          </div>
          {!lite && tags.length ? (
            <div className={`inv-tags${isMobile ? " inv-tags-mobile" : ""}`.trim()}>
              {tags.slice(0, isMobile ? 2 : 4).map((tag) => (
                <span key={tag} className="inv-tag">#{tag}</span>
              ))}
            </div>
          ) : null}
          {item.updated_by === "dm" ? (
            <div className="inv-note small">изменено DM</div>
          ) : null}
        </div>
      </div>

      {showDesc ? (
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
        <InventoryItemActions
          actionsId={actionsId}
          actionsLabel={actionsLabel}
          compact={compact}
          readOnly={readOnly}
          isFavorite={isFavorite}
          isHidden={isHidden}
          transferDisabled={transferDisabled}
          onToggleFavorite={onToggleFavorite}
          onEdit={onEdit}
          onTransfer={onTransfer}
          onToggleVisibility={onToggleVisibility}
          onDelete={onDelete}
        />
      ) : null}
      {isMobile && hasActions ? (
        <InventoryItemMobileActions
          itemName={item.name}
          quickOpen={quickOpen}
          setQuickOpen={setQuickOpen}
          readOnly={readOnly}
          isFavorite={isFavorite}
          isHidden={isHidden}
          transferDisabled={transferDisabled}
          onToggleFavorite={onToggleFavorite}
          onEdit={onEdit}
          onTransfer={onTransfer}
          onToggleVisibility={onToggleVisibility}
          onDelete={onDelete}
        />
      ) : null}
    </div>
  );
}

export default memo(InventoryItemCard);





