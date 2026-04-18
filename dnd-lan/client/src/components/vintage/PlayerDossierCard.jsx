import React from "react";
import { Scale } from "lucide-react";
import PolaroidFrame from "./PolaroidFrame.jsx";
import { t } from "../../i18n/index.js";
import {
  getPlayerPrimaryName,
  getPlayerSecondaryName,
  getPublicProfileMeta
} from "../../player/publicProfileViewModel.js";

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
  const publicProfile = player.publicProfile || null;
  const primaryName = getPlayerPrimaryName(player, publicProfile);
  const secondaryName = getPlayerSecondaryName(player, publicProfile);
  const publicMeta = getPublicProfileMeta(publicProfile);
  const publicChips = getPublicProfileChips(publicProfile);
  const initial = primaryName.slice(0, 1).toUpperCase();
  const avatar = publicProfile?.avatarUrl || player.avatarUrl || null;
  const weight = Number(player.inventoryWeight || 0);
  const limit = Number(player.inventoryLimit || 0);
  const weightLabel = Number.isFinite(limit) && limit > 0
    ? `${weight.toFixed(2)} / ${limit}`
    : `${weight.toFixed(2)} / \u221e`;
  const clickable = typeof onClick === "function";
  const lastSeenLabel = player.lastSeen ? formatLastSeenCompact(player.lastSeen) : "-";
  const statusClass = String(player.status || "offline").toLowerCase();

  return (
    <div
      className={`item taped dossier-card tf-roster-card status-${statusClass}${selected ? " selected" : ""}`.trim()}
      onClick={clickable ? onClick : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `Открыть публичный профиль: ${primaryName}` : undefined}
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
              <span>{primaryName}</span>
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
        {secondaryName ? <div className="small dossier-last-seen">@{secondaryName}</div> : null}
        {publicChips.length ? (
          <div className="dossier-public-chips" aria-label={publicMeta || "Открытые поля профиля"}>
            {publicChips.map((chip) => (
              <span key={chip.key} className="badge secondary dossier-public-chip">{chip.label}</span>
            ))}
          </div>
        ) : (
          <div className="small dossier-public-compact">Базовая карточка: имя и аватар</div>
        )}
        {publicProfile?.publicBlurb ? (
          <div className="small bio-text dossier-preview">{publicProfile.publicBlurb}</div>
        ) : null}
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

function getPublicProfileChips(profile) {
  if (!profile) return [];
  return [
    profile.classRole ? { key: "classRole", label: profile.classRole } : null,
    profile.level != null ? { key: "level", label: `ур. ${profile.level}` } : null,
    profile.race ? { key: "race", label: profile.race } : null
  ].filter(Boolean);
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
