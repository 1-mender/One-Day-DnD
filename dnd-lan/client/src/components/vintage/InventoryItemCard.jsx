import React from "react";

export default function InventoryItemCard({ item, onEdit, onDelete, readOnly }) {
  const v = item.visibility === "hidden" ? "Hidden" : "Public";

  return (
    <div className="item" style={{ alignItems: "stretch" }}>
      <div style={{ display: "grid", gridTemplateColumns: "86px 1fr", gap: 12, flex: 1 }}>
        <div
          style={{
            borderRadius: 14,
            border: "1px solid rgba(70,55,30,.28)",
            background:
              "linear-gradient(180deg, rgba(0,0,0,.06), rgba(0,0,0,0)), rgba(255,255,255,.35)",
            display: "grid",
            placeItems: "center",
            boxShadow: "inset 0 0 0 2px rgba(255,255,255,.18)"
          }}
          title="Позже можно подставлять иконку/картинку предмета"
        >
          <span style={{ fontSize: 18, opacity: 0.75, fontWeight: 900 }}>ITEM</span>
        </div>

        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{item.name}</div>
            <span className="badge" title="Количество">x{item.qty}</span>
            <span className="badge" title="Видимость">{v}</span>
            {item.updated_by === "dm" && <span className="badge warn">изменено DM</span>}
          </div>

          <div className="small" style={{ marginTop: 6 }}>
            Редкость: <b>{item.rarity}</b> • Вес: <b>{Number(item.weight || 0)}</b>
          </div>

          {!!item.description && (
            <div style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.35 }}>
              {item.description}
            </div>
          )}

          {Array.isArray(item.tags) && item.tags.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {item.tags.slice(0, 6).map((t) => (
                <span key={t} className="badge secondary">{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 96 }}>
        <button className="btn secondary" onClick={onEdit} disabled={readOnly}>Ред.</button>
        <button className="btn danger" onClick={onDelete} disabled={readOnly}>Удал.</button>
      </div>
    </div>
  );
}
