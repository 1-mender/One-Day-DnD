import React from "react";
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

export default function InventoryItemCard({ item, readOnly, onEdit, onDelete, onToggleVisibility }) {
  const icon = pickIcon(item);
  const vis = item.visibility === "hidden" ? "Скрытый" : "Публичный";
  const img = item.imageUrl || null;
  const hasActions = !!onEdit || !!onDelete || !!onToggleVisibility;

  return (
    <div className="item taped" style={{ alignItems: "stretch" }}>
      <PolaroidFrame src={img} alt={item.name} fallback={icon} />

      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontWeight: 1000, fontSize: 16 }}>{item.name}</div>
          <span className="badge">x{item.qty}</span>
          <span className="badge">{vis}</span>
          <span className="badge">вес:{Number(item.weight || 0)}</span>
          {item.updated_by === "dm" && <span className="badge warn">изменено DM</span>}
        </div>

        <div style={{ marginTop: 8 }}>
          <RarityRang rarity={item.rarity} />
        </div>

        {item.description ? (
          <div style={{ marginTop: 8 }}>
            <MarkdownView source={item.description} />
          </div>
        ) : null}

        {Array.isArray(item.tags) && item.tags.length ? (
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {item.tags.slice(0, 8).map((t) => <span key={t} className="badge secondary">{t}</span>)}
          </div>
        ) : null}
      </div>

      {hasActions ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 110 }}>
          {onEdit && <button className="btn secondary" onClick={onEdit} disabled={readOnly}>Ред.</button>}
          {onToggleVisibility && (
            <button className="btn secondary" onClick={onToggleVisibility} disabled={readOnly}>
              {item.visibility === "hidden" ? "Сделать публичным" : "Сделать скрытым"}
            </button>
          )}
          {onDelete && <button className="btn danger" onClick={onDelete} disabled={readOnly}>Удал.</button>}
        </div>
      ) : null}
    </div>
  );
}
