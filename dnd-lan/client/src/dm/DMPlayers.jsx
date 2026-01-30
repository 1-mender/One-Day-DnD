import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { connectSocket } from "../socket.js";
import PlayerDossierCard from "../components/vintage/PlayerDossierCard.jsx";

export default function DMPlayers() {
  const [players, setPlayers] = useState([]);
  const nav = useNavigate();
  const socket = useMemo(() => connectSocket({ role: "dm" }), []);

  async function load() {
    const r = await api.dmPlayers();
    setPlayers(r.items || []);
  }

  useEffect(() => {
    load().catch(()=>{});
    socket.on("players:updated", () => load().catch(()=>{}));
    socket.on("player:statusChanged", () => load().catch(()=>{}));
    return () => socket.disconnect();
  }, []);

  async function viewAs(playerId) {
    const r = await api.dmImpersonate(playerId, "ro");
    const url = `/app?imp=1&token=${encodeURIComponent(r.playerToken)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openProfile(playerId) {
    nav(`/dm/app/players/${playerId}/profile`);
  }

  return (
    <div className="card taped">
      <div style={{ fontWeight: 900, fontSize: 20 }}>Players</div>
      <div className="small">“Как игрок” открывается в режиме read-only</div>
      <hr />
      <div className="list">
        {players.map((p) => (
          <PlayerDossierCard
            key={p.id}
            player={p}
            rightActions={(
              <>
                <button className="btn" onClick={() => openProfile(p.id)}>Профиль персонажа</button>
                <button className="btn secondary" onClick={() => viewAs(p.id)}>Как игрок</button>
                <button className="btn danger" onClick={() => api.dmKick(p.id).then(load)}>Kick</button>
              </>
            )}
          />
        ))}
      </div>
    </div>
  );
}
