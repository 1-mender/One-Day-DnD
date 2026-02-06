import React from "react";
import { Scale } from "lucide-react";
import PolaroidFrame from "./PolaroidFrame.jsx";

function StatusStamp({ status }) {
  const s = String(status || "offline");
  const cls = s === "online" ? "online" : s === "idle" ? "idle" : "offline";
  const label = s === "online" ? "ONLINE" : s === "idle" ? "IDLE" : "OFFLINE";
  return <span className={`stamp ${cls}`}>{label}</span>;
}

export default function PlayerDossierCard({
  player,
  rightActions = null,
  ticketBalance = null,
  ticketStreak = null,
  menu = null,
  selected = false,
  onClick
}) {
  const initial = (player.displayName || "?").slice(0, 1).toUpperCase();
  const avatar = player.avatarUrl || null;
  const weight = Number(player.inventoryWeight || 0);
  const limit = Number(player.inventoryLimit || 0);
  const weightLabel = Number.isFinite(limit) && limit > 0
    ? `${weight.toFixed(2)} / ${limit}`
    : `${weight.toFixed(2)} / inf`;
  const clickable = typeof onClick === "function";

  return (
    <div
      className={`item taped dossier-card${selected ? " selected" : ""}`.trim()}
      style={{ alignItems: "stretch" }}
      onClick={clickable ? onClick : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      } : undefined}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <PolaroidFrame src={avatar} alt={player.displayName} fallback={initial} />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span className="badge">#{player.id}</span>
          <StatusStamp status={player.status} />
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {player.profileCreated ? (
            <span className="badge ok">ПРОФИЛЬ OK</span>
          ) : (
            <span className="badge warn">НЕТ ПРОФИЛЯ</span>
          )}
          <span className="badge secondary">ЗАМЕТКИ</span>
          <span className="badge secondary">ИНВЕНТАРЬ</span>
          {ticketBalance != null ? (
            <span className="badge">Билеты: {ticketBalance}</span>
          ) : null}
          {ticketStreak != null ? (
            <span className="badge secondary">Серия: {ticketStreak}</span>
          ) : null}
        </div>

        <div className="dossier-head">
          <div className="dossier-name">
          <span>{player.displayName}</span>
          {player.inventoryOverLimit ? (
            <span
              className="dossier-overweight"
              title={`Перегруз • Вес: ${weightLabel}`}
              aria-label={`Перегруз • Вес: ${weightLabel}`}
            >
              <Scale className="icon" aria-hidden="true" />
            </span>
          ) : null}
          </div>
          {menu ? <div className="dossier-menu">{menu}</div> : null}
        </div>
        <div className="small" style={{ marginTop: 6 }}>
          lastSeen: {player.lastSeen ? new Date(player.lastSeen).toLocaleString() : "-"}
        </div>
      </div>

      {rightActions ? <div style={{ minWidth: 140, display: "flex", flexDirection: "column", gap: 8 }}>{rightActions}</div> : null}
    </div>
  );
}
