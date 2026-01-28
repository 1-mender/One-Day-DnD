import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { connectSocket } from "../socket.js";
import PlayerDossierCard from "../components/vintage/PlayerDossierCard.jsx";

export default function Players() {
  const [players, setPlayers] = useState([]);
  const socket = useMemo(() => connectSocket({ role: "player" }), []);

  async function load() {
    const r = await api.players();
    setPlayers(r.items || []);
  }

  useEffect(() => {
    load().catch(()=>{});
    socket.on("player:statusChanged", () => load().catch(()=>{}));
    socket.on("players:updated", () => load().catch(()=>{}));
    return () => socket.disconnect();
  }, []);

  return (
    <div className="card">
      <div style={{ fontWeight: 800, fontSize: 18 }}>Игроки</div>
      <div className="small">Online/Offline обновляется автоматически</div>
      <hr />
      <div className="list">
        {players.map((p) => (
          <PlayerDossierCard key={p.id} player={p} />
        ))}
      </div>
    </div>
  );
}
