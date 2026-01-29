import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { connectSocket } from "../socket.js";
import PlayerDossierCard from "../components/vintage/PlayerDossierCard.jsx";
import { useQueryState } from "../hooks/useQueryState.js";
import ErrorBanner from "../components/ui/ErrorBanner.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import { formatError } from "../lib/formatError.js";

export default function Players() {
  const [q, setQ] = useQueryState("q", "");
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const socket = useMemo(() => connectSocket({ role: "player" }), []);

  async function load() {
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
  }

  useEffect(() => {
    load().catch(()=>{});
    socket.on("player:statusChanged", () => load().catch(()=>{}));
    socket.on("players:updated", () => load().catch(()=>{}));
    return () => socket.disconnect();
  }, []);

  const filtered = useMemo(() => {
    const qq = String(q || "").toLowerCase().trim();
    return (players || []).filter((p) => {
      if (!qq) return true;
      return String(p.displayName || "").toLowerCase().includes(qq);
    });
  }, [players, q]);

  return (
    <div className="card">
      <div style={{ fontWeight: 1000, fontSize: 20 }}>Игроки</div>
      <div className="small">Досье и статусы (Online/Idle/Offline)</div>
      <hr />
      <div className="row" style={{ flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск игроков..." style={{ width: "min(520px, 100%)" }} />
        <button className="btn secondary" onClick={load}>Обновить</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <ErrorBanner message={err} onRetry={load} />

        {loading ? (
          <div className="list">
            <div className="item"><Skeleton h={120} w="100%" /></div>
            <div className="item"><Skeleton h={120} w="100%" /></div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Нет игроков" hint="Подключите игроков через лобби." />
        ) : (
          <div className="list">
            {filtered.map((p) => (
              <PlayerDossierCard key={p.id} player={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
