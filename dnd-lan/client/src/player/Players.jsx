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
          <div style={{ fontWeight: 1000, fontSize: 20 }}>Игроки</div>
          <div className="small">Показаны только Online/Idle (Offline скрыты)</div>
          <hr />
          <div className="row" style={{ flexWrap: "wrap" }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск игроков..." style={{ width: "min(520px, 100%)" }} />
            <button className="btn secondary" onClick={load}><RefreshCcw className="icon" aria-hidden="true" />Обновить</button>
          </div>

          <div style={{ marginTop: 12 }}>
            <ErrorBanner message={err} onRetry={load} />

            {loading ? (
              <div className="list">
                <div className="item"><Skeleton h={120} w="100%" /></div>
                <div className="item"><Skeleton h={120} w="100%" /></div>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState title="Нет онлайн игроков" hint="Offline игроки скрыты. Подключите игроков через лобби." />
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
          <div style={{ fontWeight: 800 }}>Легенда статусов</div>
          <div className="small">Отражает текущую активность</div>
          <hr />
          <div className="list">
            <div className="item">
              <div className="kv">
                <div style={{ fontWeight: 700 }}>Online</div>
                <div className="small">Игрок активен</div>
              </div>
              <PlayerStatusPill status="online" />
            </div>
            <div className="item">
              <div className="kv">
                <div style={{ fontWeight: 700 }}>Idle</div>
                <div className="small">Нет активности</div>
              </div>
              <PlayerStatusPill status="idle" />
            </div>
            <div className="item">
              <div className="kv">
                <div style={{ fontWeight: 700 }}>Offline</div>
                <div className="small">Отключён</div>
              </div>
              <PlayerStatusPill status="offline" />
            </div>
          </div>
          <div className="paper-note" style={{ marginTop: 10 }}>
            <div className="title">Совет</div>
            <div className="small">Если статус завис — обновите страницу.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

