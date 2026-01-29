import React from "react";
import PolaroidFrame from "./PolaroidFrame.jsx";

function StatusStamp({ status }) {
  const s = String(status || "offline");
  const cls = s === "online" ? "online" : s === "idle" ? "idle" : "offline";
  const label = s === "online" ? "ONLINE" : s === "idle" ? "IDLE" : "OFFLINE";
  return <span className={`stamp ${cls}`}>{label}</span>;
}

export default function PlayerDossierCard({ player, rightActions = null }) {
  const initial = (player.displayName || "?").slice(0, 1).toUpperCase();
  const avatar = player.avatarUrl || null;

  return (
    <div className="item taped" style={{ alignItems: "stretch" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <PolaroidFrame src={avatar} alt={player.displayName} fallback={initial} />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span className="badge">#{player.id}</span>
          <StatusStamp status={player.status} />
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="badge secondary">PROFILE</span>
          <span className="badge secondary">NOTES</span>
          <span className="badge secondary">INVENTORY</span>
        </div>

        <div style={{ marginTop: 10, fontWeight: 1000, fontSize: 18 }}>
          {player.displayName}
        </div>
        <div className="small" style={{ marginTop: 6 }}>
          lastSeen: {player.lastSeen ? new Date(player.lastSeen).toLocaleString() : "-"}
        </div>
      </div>

      {rightActions ? <div style={{ minWidth: 140, display: "flex", flexDirection: "column", gap: 8 }}>{rightActions}</div> : null}
    </div>
  );
}
