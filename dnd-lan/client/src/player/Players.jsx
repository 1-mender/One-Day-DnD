import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import PlayerDossierCard from "../components/vintage/PlayerDossierCard.jsx";
import PlayerStatusPill from "../components/PlayerStatusPill.jsx";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Activity, RefreshCcw, Users } from "lucide-react";
import { useQueryState } from "../hooks/useQueryState.js";
import ErrorBanner from "../components/ui/ErrorBanner.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import { formatError } from "../lib/formatError.js";
import { useSocket } from "../context/SocketContext.jsx";

export default function Players() {
  const [q, setQ] = useQueryState("q", "");
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const { socket } = useSocket();
  const [listRef] = useAutoAnimate({ duration: 200 });

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
    const qq = String(q || "").toLowerCase().trim();
    return (players || [])
      .filter((p) => ["online", "idle"].includes(String(p.status || "offline")))
      .filter((p) => {
        if (!qq) return true;
        return String(p.displayName || "").toLowerCase().includes(qq);
      });
  }, [players, q]);

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

  return (
    <div className="spread-grid players-grid">
      <div className="spread-col">
        <section className="card taped scrap-card paper-stack no-stamp tf-shell tf-players-shell">
          <div className="players-head tf-page-head">
            <div className="tf-page-head-main">
              <div className="tf-overline">Party roster</div>
              <div className="u-title-xl tf-page-title">Игроки</div>
              <div className="small">Показаны только статусы «Онлайн» и «Нет активности». Оффлайн остаётся в сводке справа.</div>
            </div>
            <div className="players-head-meta">
              <span className="badge secondary">Видимых: {filtered.length}</span>
              <span className="badge">Всего: {players.length}</span>
            </div>
          </div>

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

          <div className="players-toolbar tf-panel tf-command-bar">
            <div className="tf-section-copy">
              <div className="tf-section-kicker">Search roster</div>
              <div className="players-toolbar-title">Поиск и обновление</div>
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
          </div>

          <div className="u-mt-12 players-roster">
            <ErrorBanner message={err} onRetry={load} />

            {loading ? (
              <div className="list players-list">
                <div className="item"><Skeleton h={120} w="100%" /></div>
                <div className="item"><Skeleton h={120} w="100%" /></div>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState title="Нет игроков онлайн" hint="Оффлайн-игроки скрыты. Подключите игроков через лобби." />
            ) : (
              <div className="list players-list" ref={listRef}>
                {filtered.map((p) => (
                  <PlayerDossierCard key={p.id} player={p} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="spread-col">
        <div className="players-side-stack">
          <section className="card taped scrap-card no-stamp tf-panel tf-players-guide">
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
                  <div className="small">Игрок отключён и скрыт из списка слева.</div>
                </div>
                <PlayerStatusPill status="offline" />
              </div>
            </div>
          </section>

          <section className="card taped scrap-card no-stamp tf-panel tf-players-note">
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
              <div className="small">Если статус завис, обнови страницу или подожди следующий push по WebSocket.</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

