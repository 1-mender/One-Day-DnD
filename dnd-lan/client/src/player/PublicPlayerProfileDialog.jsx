import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";
import PolaroidFrame from "../components/vintage/PolaroidFrame.jsx";
import PlayerStatusPill from "../components/PlayerStatusPill.jsx";
import { EmptyState, ErrorBanner, Skeleton } from "../foundation/primitives/index.js";
import { formatError } from "../lib/formatError.js";
import {
  getPlayerPrimaryName,
  getPlayerSecondaryName,
  getPublicProfileMeta
} from "./publicProfileViewModel.js";

export default function PublicPlayerProfileDialog({ open, player, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [notCreated, setNotCreated] = useState(false);

  useEffect(() => {
    if (!open || !player?.id) {
      setProfile(null);
      setErr("");
      setLoading(false);
      setNotCreated(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErr("");
    setNotCreated(false);

    api.playerPublicProfile(player.id)
      .then((response) => {
        if (cancelled) return;
        setProfile(response?.profile || null);
        setNotCreated(Boolean(response?.notCreated));
      })
      .catch((error) => {
        if (cancelled) return;
        setErr(formatError(error));
        setProfile(null);
        setNotCreated(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, player?.id]);

  const fallbackProfile = useMemo(() => player?.publicProfile || null, [player]);
  const effectiveProfile = profile || fallbackProfile;
  const primaryName = getPlayerPrimaryName(player, effectiveProfile);
  const secondaryName = getPlayerSecondaryName(player, effectiveProfile);
  const meta = getPublicProfileMeta(effectiveProfile);
  const avatar = effectiveProfile?.avatarUrl || player?.avatarUrl || null;
  const initial = primaryName.slice(0, 1).toUpperCase() || "?";
  const hasPublicBlurb = Boolean(effectiveProfile?.publicBlurb);
  const hasExpandedCard = Boolean(meta);

  return (
    <Modal
      open={open}
      headerless
      onClose={onClose}
      className="player-public-profile-modal"
      bodyClassName="player-public-profile-modal-body"
    >
      {!player ? null : (
        <div className="player-public-profile">
          <button
            type="button"
            className="btn secondary player-public-profile-close"
            onClick={onClose}
            aria-label="Закрыть публичный профиль"
          >
            <X className="icon" aria-hidden="true" />
          </button>

          <div className="card taped scrap-card no-stamp player-public-profile-sheet">
            <div className="player-public-profile-hero">
              <PolaroidFrame src={avatar} alt={primaryName} fallback={initial} className="lg" />
              <div className="player-public-profile-heading">
                <div className="player-public-profile-title">{primaryName}</div>
                {secondaryName ? <div className="small player-public-profile-subtitle">@{secondaryName}</div> : null}
                <div className="player-public-profile-status">
                  <PlayerStatusPill status={player.status} />
                  <span className="badge secondary">Игрок #{player.id}</span>
                </div>
                {hasExpandedCard ? (
                  <div className="player-public-profile-meta">{meta}</div>
                ) : (
                  <div className="small player-public-profile-muted">
                    Открыта базовая карточка: имя, аватар и статус игрока.
                  </div>
                )}
                {hasPublicBlurb ? (
                  <div className="player-public-profile-blurb u-pre-wrap">{effectiveProfile.publicBlurb}</div>
                ) : null}
                {!hasExpandedCard && !hasPublicBlurb ? (
                  <div className="player-public-profile-compact-note">
                    Дополнительные поля персонажа пока скрыты от партии.
                  </div>
                ) : null}
                <div className="player-public-profile-footer">
                  <span>Последняя активность: {formatLastSeen(player?.lastSeen)}</span>
                  <span>Карточка: {hasExpandedCard || hasPublicBlurb ? "расширенная" : "базовая"}</span>
                </div>
              </div>
            </div>
          </div>

          <ErrorBanner message={err} />

          {loading ? (
            <div className="list">
              <div className="item"><Skeleton h={320} w="100%" /></div>
            </div>
          ) : err ? null : notCreated ? (
            <EmptyState
              title="Профиль ещё не оформлен"
              hint="У этого игрока пока нет созданного профиля персонажа."
            />
          ) : null}
        </div>
      )}
    </Modal>
  );
}

function formatLastSeen(value) {
  if (!value) return "Нет данных";
  try {
    return new Date(value).toLocaleString([], {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "Нет данных";
  }
}
