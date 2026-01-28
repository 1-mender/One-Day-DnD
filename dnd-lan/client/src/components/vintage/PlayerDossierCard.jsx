import React from "react";
import PlayerStatusPill from "../PlayerStatusPill.jsx";

export default function PlayerDossierCard({ player, onAction, actions = null }) {
  const initial = (player.displayName || "?").slice(0, 1).toUpperCase();

  return (
    <div className="item" style={{ alignItems: "stretch" }}>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, flex: 1 }}>
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(70,55,30,.28)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,.45), rgba(255,255,255,.15)), rgba(0,0,0,.05)",
            padding: 10,
            boxShadow: "inset 0 0 0 2px rgba(255,255,255,.2)"
          }}
        >
          <div
            style={{
              borderRadius: 12,
              height: 90,
              display: "grid",
              placeItems: "center",
              background: "rgba(0,0,0,.08)",
              border: "1px solid rgba(70,55,30,.18)",
              fontWeight: 900,
              fontSize: 30
            }}
            title="Позже можно подставить аватар"
          >
            {initial}
          </div>

          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="badge">{player.id}</span>
            <PlayerStatusPill status={player.status} />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="badge secondary">PROFILE</span>
            <span className="badge secondary">NOTES</span>
            <span className="badge secondary">INVENTORY</span>
          </div>

          <div style={{ marginTop: 10, fontWeight: 900, fontSize: 18 }}>
            {player.displayName}
          </div>
          <div className="small" style={{ marginTop: 6 }}>
            lastSeen: {player.lastSeen ? new Date(player.lastSeen).toLocaleString() : "—"}
          </div>
        </div>
      </div>

      {actions ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 120 }}>
          {actions}
        </div>
      ) : (
        onAction ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 120 }}>
            <button className="btn secondary" onClick={onAction}>Действие</button>
          </div>
        ) : null
      )}
    </div>
  );
}
