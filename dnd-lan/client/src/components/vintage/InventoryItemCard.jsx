import React from "react";
import { Eye, EyeOff, Package, PencilLine, Scale, Trash2 } from "lucide-react";
import MarkdownView from "../markdown/MarkdownView.jsx";
import PolaroidFrame from "./PolaroidFrame.jsx";
import RarityRang from "./RarityRang.jsx";

function pickIcon(item) {
  const tags = (item.tags || []).map((t) => String(t).toLowerCase());
  if (tags.some((t) => t.includes("weapon") || t.includes("меч") || t.includes("лук"))) return "МЕЧ";
  if (tags.some((t) => t.includes("armor") || t.includes("брон"))) return "БРОНЯ";
  if (tags.some((t) => t.includes("potion") || t.includes("зель"))) return "ЗЕЛЬЕ";
  if (tags.some((t) => t.includes("scroll") || t.includes("свит"))) return "СВИТОК";
  return "ПРЕДМ";
}

export default function InventoryItemCard({
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
  const img = item.imageUrl || null;
  const hasActions = !!onEdit || !!onDelete || !!onToggleVisibility;
  const weight = Number(item.weight || 0);
  const compact = actionsVariant === "compact";

  return (
    <div className="item taped inv-card" data-visibility={item.visibility} style={{ alignItems: "stretch" }}>
      <div className="inv-illu">
        <PolaroidFrame className="sm" src={img} alt={item.name} fallback={icon} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="inv-meta">
          <div className="inv-title">{item.name}</div>
          <span className="badge"><Package className="icon" />x{item.qty}</span>
          <span className={`badge ${isHidden ? "off" : "ok"}`}>
            {isHidden ? <EyeOff className="icon" /> : <Eye className="icon" />}{vis}
          </span>
          <span className="badge secondary"><Scale className="icon" />{weight.toFixed(2)}</span>
          {item.updated_by === "dm" && <span className="badge warn">изменено DM</span>}
        </div>

        <div className="inv-meta" style={{ marginTop: 8 }}>
          <RarityRang rarity={item.rarity} />
          {Array.isArray(item.tags) && item.tags.length ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {item.tags.slice(0, 8).map((t) => <span key={t} className="badge secondary">{t}</span>)}
            </div>
          ) : null}
        </div>

        {item.description ? (
          <div className="inv-desc" style={{ marginTop: 8 }}>
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
