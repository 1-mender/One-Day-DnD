import React, { memo } from "react";
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
  onSelectChange
}) {
  const icon = pickInventoryIcon(item);
  const isHidden = item.visibility === "hidden";
  const vis = isHidden ? "Скрытый" : "Публичный";
  const hasActions = !!onEdit || !!onDelete || !!onToggleVisibility || !!onToggleFavorite;
  const weight = Number(item.weight || 0);
  const rarityKey = String(item.rarity || "common").toLowerCase().replace(/\s+/g, "_");
  const rarityLabel = getRarityLabel(rarityKey);
  const tags = stripIconTags(Array.isArray(item.tags) ? item.tags.filter(Boolean) : []);
  const isFavorite = tags.includes("favorite");
  const compact = actionsVariant === "compact";
  const metaParts = (
    lite
      ? [
        `Вес: ${weight.toFixed(2)}`,
        `Редкость: ${rarityLabel}`
      ]
      : [
        `Вес: ${weight.toFixed(2)}`,
        `Редкость: ${rarityLabel}`,
        tags.length ? `Теги: ${tags.slice(0, 3).join(", ")}` : null,
        item.updated_by === "dm" ? "изменено DM" : null
      ]
  ).filter(Boolean);
  const descText = lite ? truncateText(toPlainText(item.description), 180) : "";

  return (
    <div
      className="item taped inv-card"
      data-rarity={rarityKey}
      data-visibility={item.visibility}
      data-favorite={isFavorite ? "true" : "false"}
      data-variant={actionsVariant}
      data-lite={lite ? "true" : "false"}
      style={{ contentVisibility: "auto", containIntrinsicSize: "180px" }}
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
      <div className="inv-hero" data-has-image="false">
        {icon.Icon ? (
          <icon.Icon className="inv-icon" aria-hidden="true" />
        ) : (
          <div className="inv-fallback">{icon.text}</div>
        )}
      </div>

      <div className="inv-body">
        <div className="inv-title-row">
          <div className="inv-title">{item.name}</div>
          <RarityBadge rarity={rarityKey} />
        </div>
        <div className="inv-badges">
          <span className="badge">x{item.qty}</span>
          {isFavorite ? (
            <span className="badge warn">
              <Star className="icon" aria-hidden="true" />Избранное
            </span>
          ) : null}
          <span className={`badge ${isHidden ? "off" : "ok"}`}>
            {isHidden ? <EyeOff className="icon" aria-hidden="true" /> : <Eye className="icon" aria-hidden="true" />}{vis}
          </span>
        </div>
        {metaParts.length ? (
          <div className="inv-meta-line small">
            {metaParts.map((part, idx) => (
              <span key={`${part}-${idx}`} className="inv-meta-item">
                {idx > 0 ? "• " : ""}{part}
              </span>
            ))}
          </div>
        ) : null}
        {item.description ? (
          lite ? (
            <div className="inv-desc inv-desc-lite">{descText}</div>
          ) : (
            <div className="inv-desc">
              <MarkdownView source={item.description} />
            </div>
          )
        ) : null}
      </div>

      {hasActions ? (
        <div className={`inv-actions ${compact ? "compact" : ""}`.trim()}>
          {onToggleFavorite ? (
            <button
              className={`btn secondary ${compact ? "icon-btn" : ""}`.trim()}
              onClick={onToggleFavorite}
              disabled={readOnly}
              title={isFavorite ? "Убрать из избранного" : "В избранное"}
              aria-label={isFavorite ? "Убрать из избранного" : "В избранное"}
            >
              {isFavorite ? <StarOff className="icon" aria-hidden="true" /> : <Star className="icon" aria-hidden="true" />}
              {compact ? null : (isFavorite ? "Убрать из избранного" : "В избранное")}
            </button>
          ) : null}
          {onEdit && (
            <button
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
          {onToggleVisibility && (
            <button
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
    </div>
  );
}

export default memo(InventoryItemCard);





