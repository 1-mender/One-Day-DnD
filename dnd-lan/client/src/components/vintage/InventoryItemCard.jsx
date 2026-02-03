import React, { memo } from "react";
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
  PencilLine,
  PocketKnife,
  ScrollText,
  Shield,
  Skull,
  Sword,
  Trash2,
  Wand
} from "lucide-react";
import { getInventoryImageProps } from "../../lib/imageSizing.js";
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

function pickIcon(item) {
  const tokens = [
    item.name,
    item.type,
    item.category,
    ...(Array.isArray(item.tags) ? item.tags : [])
  ].filter(Boolean).map((t) => String(t).toLowerCase());
  const hay = tokens.join(" ");
  const rule = TAG_ICON_RULES.find((r) => r.match.some((m) => hay.includes(m)));
  if (rule?.icon) return { Icon: rule.icon };
  return { text: pickFallbackText(tokens) };
}

function InventoryItemCard({
  item,
  readOnly,
  onEdit,
  onDelete,
  onToggleVisibility,
  actionsVariant = "stack"
}) {
  const icon = pickIcon(item);
  const isHidden = item.visibility === "hidden";
  const vis = isHidden ? "Скрытый" : "Публичный";
  const img = item.imageUrl || item.image_url || null;
  const imageProps = getInventoryImageProps(img);
  const hasActions = !!onEdit || !!onDelete || !!onToggleVisibility;
  const weight = Number(item.weight || 0);
  const rarityKey = String(item.rarity || "common").toLowerCase().replace(/\s+/g, "_");
  const rarityLabel = getRarityLabel(rarityKey);
  const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
  const compact = actionsVariant === "compact";
  const metaParts = [
    `Вес: ${weight.toFixed(2)}`,
    `Редкость: ${rarityLabel}`,
    tags.length ? `Теги: ${tags.slice(0, 3).join(", ")}` : null,
    item.updated_by === "dm" ? "изменено DM" : null
  ].filter(Boolean);

  return (
    <div
      className="item taped inv-card"
      data-rarity={rarityKey}
      data-visibility={item.visibility}
      data-variant={actionsVariant}
      style={{ contentVisibility: "auto", containIntrinsicSize: "180px" }}
    >
      <div className="inv-hero" data-has-image={img ? "true" : "false"}>
        {img ? (
          <img
            src={img}
            alt={item.name}
            loading="lazy"
            decoding="async"
            width={imageProps.width}
            height={imageProps.height}
            sizes={imageProps.sizes}
            srcSet={imageProps.srcSet}
          />
        ) : icon.Icon ? (
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
          <div className="inv-desc">
            <MarkdownView source={item.description} />
          </div>
        ) : null}
      </div>

      {hasActions ? (
        <div className={`inv-actions ${compact ? "compact" : ""}`.trim()}>
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

