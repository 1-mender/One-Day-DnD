import React from "react";
import { Scale } from "lucide-react";
import PolaroidFrame from "./PolaroidFrame.jsx";
import { t } from "../../i18n/index.js";

function StatusStamp({ status }) {
  const s = String(status || "offline");
  const cls = s === "online" ? "online" : s === "idle" ? "idle" : "offline";
  const label = t(`playerStatus.${cls}`, null, cls).toUpperCase();
  return <span className={`stamp tf-status-stamp dossier-status-stamp ${cls}`}>{label}</span>;
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
    : `${weight.toFixed(2)} / \u221e`;
  const clickable = typeof onClick === "function";
  const lastSeenLabel = player.lastSeen ? formatLastSeenCompact(player.lastSeen) : "-";

  return (
    <div
      className={`item taped dossier-card tf-roster-card${selected ? " selected" : ""}`.trim()}
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
      <div className="dossier-side">
        <PolaroidFrame src={avatar} alt={player.displayName} fallback={initial} />
      </div>

      <div className="dossier-body">
        <div className="dossier-head">
          <div className="dossier-header-row">
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
            <div className="dossier-topmeta">
              <span className="badge secondary dossier-id-badge">#{player.id}</span>
              <StatusStamp status={player.status} />
            </div>
            {menu ? <div className="dossier-menu">{menu}</div> : null}
          </div>
        </div>
        <div className="small dossier-last-seen" title={player.lastSeen || ""}>{lastSeenLabel}</div>
        <div className="dossier-flags">
          {player.profileCreated ? (
            <span className="badge ok">ПРОФИЛЬ</span>
          ) : (
            <span className="badge warn">НЕТ ПРОФ.</span>
          )}
          <span className="badge secondary">ЗАМЕТКИ</span>
          <span className="badge secondary">ИНВ.</span>
          {ticketBalance != null ? (
            <span className="badge">Билеты: {ticketBalance}</span>
          ) : null}
          {ticketStreak != null ? (
            <span className="badge secondary">Серия: {ticketStreak}</span>
          ) : null}
        </div>
      </div>

      {rightActions ? <div className="dossier-actions">{rightActions}</div> : null}
    </div>
  );
}

function formatLastSeenCompact(value) {
  try {
    return new Date(value).toLocaleString([], {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "-";
  }
}
