import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import PlayerDossierCard from "../components/vintage/PlayerDossierCard.jsx";
import PlayerStatusPill from "../components/PlayerStatusPill.jsx";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { RefreshCcw } from "lucide-react";
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

  return (
    <div className="spread-grid">
      <div className="spread-col">
        <div className="card taped scrap-card paper-stack no-stamp">
          <div className="u-title-xl">Игроки</div>
          <div className="small">Показаны только статусы «Онлайн» и «Нет активности» (оффлайн скрыт)</div>
          <hr />
          <div className="row u-row-wrap">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск игроков..."
              aria-label="Поиск игроков"
              className="u-w-min-520"
            />
            <button className="btn secondary" onClick={load}><RefreshCcw className="icon" aria-hidden="true" />Обновить</button>
          </div>

          <div className="u-mt-12">
            <ErrorBanner message={err} onRetry={load} />

            {loading ? (
              <div className="list">
                <div className="item"><Skeleton h={120} w="100%" /></div>
                <div className="item"><Skeleton h={120} w="100%" /></div>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState title="Нет игроков онлайн" hint="Оффлайн-игроки скрыты. Подключите игроков через лобби." />
            ) : (
              <div className="list" ref={listRef}>
                {filtered.map((p) => (
                  <PlayerDossierCard key={p.id} player={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="spread-col">
        <div className="card taped scrap-card no-stamp">
          <div className="u-fw-800">Легенда статусов</div>
          <div className="small">Отражает текущую активность</div>
          <hr />
          <div className="list">
            <div className="item">
              <div className="kv">
                <div className="u-fw-700">Онлайн</div>
                <div className="small">Игрок активен</div>
              </div>
              <PlayerStatusPill status="online" />
            </div>
            <div className="item">
              <div className="kv">
                <div className="u-fw-700">Нет активности</div>
                <div className="small">Нет активности</div>
              </div>
              <PlayerStatusPill status="idle" />
            </div>
            <div className="item">
              <div className="kv">
                <div className="u-fw-700">Оффлайн</div>
                <div className="small">Отключён</div>
              </div>
              <PlayerStatusPill status="offline" />
            </div>
          </div>
          <div className="paper-note u-mt-10">
            <div className="title">Совет</div>
            <div className="small">Если статус завис — обновите страницу.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

