import React, { memo } from "react";
import { Eye, EyeOff, PencilLine, Trash2 } from "lucide-react";
import { getInventoryImageProps } from "../../lib/imageSizing.js";
import { getRarityLabel } from "../../lib/inventoryRarity.js";
import MarkdownView from "../markdown/MarkdownView.jsx";
import RarityBadge from "./RarityBadge.jsx";

function pickIcon(item) {
  const tags = (item.tags || []).map((t) => String(t).toLowerCase());
  if (tags.some((t) => t.includes("weapon") || t.includes("меч") || t.includes("лук"))) return "МЕЧ";
  if (tags.some((t) => t.includes("armor") || t.includes("брон"))) return "БРОНЯ";
  if (tags.some((t) => t.includes("potion") || t.includes("зель"))) return "ЗЕЛЬЕ";
  if (tags.some((t) => t.includes("scroll") || t.includes("свит"))) return "СВИТОК";
  return "ПРЕДМ";
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
  const rarity = String(item.rarity || "common");
  const rarityLabel = getRarityLabel(rarity);
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
      data-visibility={item.visibility}
      data-variant={actionsVariant}
      style={{ contentVisibility: "auto", containIntrinsicSize: "180px" }}
    >
      <div className="inv-hero">
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
        ) : (
          <div className="inv-fallback">{icon}</div>
        )}
      </div>

      <div className="inv-body">
        <div className="inv-title-row">
          <div className="inv-title">{item.name}</div>
          <RarityBadge rarity={rarity} />
        </div>
        <div className="inv-badges">
          <span className="badge">x{item.qty}</span>
          <span className={`badge ${isHidden ? "off" : "ok"}`}>
            {isHidden ? <EyeOff className="icon" /> : <Eye className="icon" />}{vis}
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
              <PencilLine className="icon" />
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
              {isHidden ? <Eye className="icon" /> : <EyeOff className="icon" />}
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
              <Trash2 className="icon" />
              {compact ? null : "Удалить"}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default memo(InventoryItemCard);
