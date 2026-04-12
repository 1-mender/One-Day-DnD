import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import VirtualizedStack from "../components/VirtualizedStack.jsx";
import PlayerDossierCard from "../components/vintage/PlayerDossierCard.jsx";
import PlayerStatusPill from "../components/PlayerStatusPill.jsx";
import PublicPlayerProfileDialog from "./PublicPlayerProfileDialog.jsx";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Activity, RefreshCcw, Users } from "lucide-react";
import { useQueryState } from "../hooks/useQueryState.js";
import { EmptyState, ErrorBanner, Skeleton } from "../foundation/primitives/index.js";
import { formatError } from "../lib/formatError.js";
import { useSocket } from "../context/SocketContext.jsx";
import { matchesPlayerQuery, matchesStatusFilter } from "./publicProfileViewModel.js";

export default function Players() {
  const [q, setQ] = useQueryState("q", "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const { socket } = useSocket();
  const [listRef] = useAutoAnimate({ duration: 200 });
  const isNarrowScreen = useIsNarrowScreen();

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const r = await api.players();
      setPlayers(r.items || []);
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!socket) return () => {};
    load().catch(() => {});
    const onStatus = () => load().catch(() => {});
    const onUpdated = () => load().catch(() => {});
    socket.on("player:statusChanged", onStatus);
    socket.on("players:updated", onUpdated);
    return () => {
      socket.off("player:statusChanged", onStatus);
      socket.off("players:updated", onUpdated);
    };
  }, [load, socket]);

  const filtered = useMemo(() => {
    return (players || [])
      .filter((player) => matchesStatusFilter(player, statusFilter))
      .filter((player) => matchesPlayerQuery(player, q));
  }, [players, q, statusFilter]);

  const selectedPlayer = useMemo(
    () => (players || []).find((player) => player.id === selectedPlayerId) || null,
    [players, selectedPlayerId]
  );

  const statusCounts = useMemo(() => {
    return (players || []).reduce(
      (acc, player) => {
        const status = String(player.status || "offline");
        if (status === "online") acc.online += 1;
        else if (status === "idle") acc.idle += 1;
        else acc.offline += 1;
        return acc;
      },
      { online: 0, idle: 0, offline: 0 }
    );
  }, [players]);

  const legendContent = (
    <>
      <div className="tf-section-head">
        <div className="tf-section-copy">
          <div className="tf-section-kicker">Field guide</div>
          <div className="u-fw-800 players-guide-title">Легенда статусов</div>
        </div>
        <Users className="players-guide-icon" aria-hidden="true" />
      </div>
      <div className="list players-legend-list">
        <div className="item">
          <div className="kv">
            <div className="u-fw-700">Онлайн</div>
            <div className="small">Игрок активен и сейчас в сессии.</div>
          </div>
          <PlayerStatusPill status="online" />
        </div>
        <div className="item">
          <div className="kv">
            <div className="u-fw-700">Нет активности</div>
            <div className="small">Соединение живое, но действий давно не было.</div>
          </div>
          <PlayerStatusPill status="idle" />
        </div>
        <div className="item">
          <div className="kv">
            <div className="u-fw-700">Оффлайн</div>
            <div className="small">Игрок отключён, но остаётся в составе партии.</div>
          </div>
          <PlayerStatusPill status="offline" />
        </div>
      </div>
    </>
  );

  const briefContent = (
    <>
      <div className="tf-section-head">
        <div className="tf-section-copy">
          <div className="tf-section-kicker">Roster brief</div>
          <div className="u-fw-800 players-guide-title">Полевая сводка</div>
        </div>
        <Activity className="players-guide-icon" aria-hidden="true" />
      </div>
      <div className="players-note-grid">
        <div className="tf-stat-card">
          <div className="small">Видно сейчас</div>
          <strong>{filtered.length}</strong>
        </div>
        <div className="tf-stat-card">
          <div className="small">Активных статусов</div>
          <strong>{statusCounts.online + statusCounts.idle}</strong>
        </div>
      </div>
      <div className="paper-note players-note-callout">
        <div className="title">Совет</div>
        <div className="small">Нажми на карточку игрока, чтобы открыть его публичное досье для партии.</div>
      </div>
    </>
  );

  const legendFoldContent = (
    <div className="list players-legend-list">
      <div className="item">
        <div className="kv">
          <div className="u-fw-700">Онлайн</div>
          <div className="small">Игрок активен и сейчас в сессии.</div>
        </div>
        <PlayerStatusPill status="online" />
      </div>
      <div className="item">
        <div className="kv">
          <div className="u-fw-700">Нет активности</div>
          <div className="small">Соединение живое, но действий давно не было.</div>
        </div>
        <PlayerStatusPill status="idle" />
      </div>
        <div className="item">
          <div className="kv">
            <div className="u-fw-700">Оффлайн</div>
            <div className="small">Игрок отключён, но остаётся в составе партии.</div>
          </div>
          <PlayerStatusPill status="offline" />
        </div>
    </div>
  );

  const briefFoldContent = (
    <>
      <div className="players-note-grid players-note-grid-mobile">
        <div className="players-brief-pill">
          <span>Видно сейчас</span>
          <strong>{filtered.length}</strong>
        </div>
        <div className="players-brief-pill">
          <span>Активных статусов</span>
          <strong>{statusCounts.online + statusCounts.idle}</strong>
        </div>
      </div>
      <div className="paper-note players-note-callout">
        <div className="title">Совет</div>
        <div className="small">Нажми на карточку игрока, чтобы открыть его публичное досье для партии.</div>
      </div>
    </>
  );

  return (
    <div className="spread-grid players-grid">
      <div className="spread-col">
        <section className="card taped scrap-card paper-stack no-stamp tf-shell tf-players-shell">
          <div className="players-head tf-page-head">
            <div className="tf-page-head-main">
              <div className="tf-overline">Party roster</div>
              <div className="u-title-xl tf-page-title">Игроки</div>
              <div className="small">Весь состав партии в одном реестре. Нажми на карточку, чтобы открыть публичный профиль игрока.</div>
            </div>
            {!isNarrowScreen ? (
              <div className="players-head-meta">
                <span className="badge secondary">Видимых: {filtered.length}</span>
                <span className="badge">Всего: {players.length}</span>
              </div>
            ) : null}
          </div>

          {isNarrowScreen ? (
            <div className="players-summary-strip">
              <div className="players-summary-pill"><span>Видимых</span><strong>{filtered.length}</strong></div>
              <div className="players-summary-pill"><span>Онлайн</span><strong>{statusCounts.online}</strong></div>
              <div className="players-summary-pill"><span>Не онлайн</span><strong>{statusCounts.idle + statusCounts.offline}</strong></div>
            </div>
          ) : (
            <div className="players-summary tf-stat-grid">
              <div className="tf-stat-card">
                <div className="small">Онлайн</div>
                <strong>{statusCounts.online}</strong>
              </div>
              <div className="tf-stat-card">
                <div className="small">Нет активности</div>
                <strong>{statusCounts.idle}</strong>
              </div>
              <div className="tf-stat-card">
                <div className="small">Оффлайн</div>
                <strong>{statusCounts.offline}</strong>
              </div>
            </div>
          )}

          <div className="players-toolbar tf-panel tf-command-bar">
            <div className="tf-section-copy">
              <div className="tf-section-kicker">Search roster</div>
              <div className="players-toolbar-title">Поиск, фильтрация и обзор</div>
            </div>
            <div className="row u-row-wrap players-toolbar-row">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Поиск игроков..."
                aria-label="Поиск игроков"
                className="u-w-min-520"
              />
              <button className="btn secondary" onClick={load}><RefreshCcw className="icon" aria-hidden="true" />Обновить</button>
            </div>
            <div className="players-filterbar" aria-label="Фильтр игроков по статусу">
              <button
                type="button"
                className={`players-filter-chip${statusFilter === "all" ? " active" : ""}`.trim()}
                onClick={() => setStatusFilter("all")}
                aria-pressed={statusFilter === "all"}
              >
                Все
              </button>
              <button
                type="button"
                className={`players-filter-chip${statusFilter === "online" ? " active" : ""}`.trim()}
                onClick={() => setStatusFilter("online")}
                aria-pressed={statusFilter === "online"}
              >
                Онлайн
              </button>
              <button
                type="button"
                className={`players-filter-chip${statusFilter === "offline" ? " active" : ""}`.trim()}
                onClick={() => setStatusFilter("offline")}
                aria-pressed={statusFilter === "offline"}
              >
                Оффлайн
              </button>
            </div>
          </div>

          <div className="u-mt-12 players-roster">
            <ErrorBanner message={err} onRetry={load} />

            {loading ? (
              <div className="list players-list">
                <div className="item"><Skeleton h={120} w="100%" /></div>
                <div className="item"><Skeleton h={120} w="100%" /></div>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState title="Никого не найдено" hint="Измени поисковый запрос или фильтр статуса." />
            ) : (
              <VirtualizedStack
                className="list players-list"
                items={filtered}
                estimateSize={164}
                rowGap={14}
                staticListRef={listRef}
                staticThreshold={20}
                getItemKey={(player) => player.id}
                renderItem={(player) => (
                  <PlayerDossierCard
                    player={player}
                    selected={player.id === selectedPlayerId}
                    onClick={() => setSelectedPlayerId(player.id)}
                  />
                )}
              />
            )}
          </div>
        </section>
      </div>

      <div className="spread-col">
        <div className="players-side-stack">
          {isNarrowScreen ? (
            <>
              <details className="tf-panel players-mobile-fold">
                <summary className="players-mobile-fold-summary">Легенда статусов</summary>
                <div className="players-mobile-fold-body">{legendFoldContent}</div>
              </details>
              <details className="tf-panel players-mobile-fold">
                <summary className="players-mobile-fold-summary">Полевая сводка</summary>
                <div className="players-mobile-fold-body">{briefFoldContent}</div>
              </details>
            </>
          ) : (
            <>
              <section className="card taped scrap-card no-stamp tf-panel tf-players-guide">
                {legendContent}
              </section>
              <section className="card taped scrap-card no-stamp tf-panel tf-players-note">
                {briefContent}
              </section>
            </>
          )}
        </div>
      </div>

      <PublicPlayerProfileDialog
        open={Boolean(selectedPlayer)}
        player={selectedPlayer}
        onClose={() => setSelectedPlayerId(null)}
      />
    </div>
  );
}

function useIsNarrowScreen(maxWidth = 720) {
  const [isNarrow, setIsNarrow] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${maxWidth}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return () => {};
    const media = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const apply = () => setIsNarrow(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [maxWidth]);

  return isNarrow;
}

