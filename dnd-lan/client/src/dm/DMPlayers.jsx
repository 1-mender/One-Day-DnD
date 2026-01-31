import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { connectSocket } from "../socket.js";
import PlayerDossierCard from "../components/vintage/PlayerDossierCard.jsx";
import Modal from "../components/Modal.jsx";
import ErrorBanner from "../components/ui/ErrorBanner.jsx";
import { formatError } from "../lib/formatError.js";

export default function DMPlayers() {
  const [players, setPlayers] = useState([]);
  const [err, setErr] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editPlayer, setEditPlayer] = useState(null);
  const [editName, setEditName] = useState("");
  const nav = useNavigate();
  const socket = useMemo(() => connectSocket({ role: "dm" }), []);

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await api.dmPlayers();
      setPlayers(r.items || []);
    } catch (e) {
      setErr(formatError(e));
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
    socket.on("players:updated", () => load().catch(() => {}));
    socket.on("player:statusChanged", () => load().catch(() => {}));
    return () => socket.disconnect();
  }, [load, socket]);

  async function viewAs(playerId) {
    setErr("");
    try {
      const r = await api.dmImpersonate(playerId, "ro");
      const url = `/app?imp=1&token=${encodeURIComponent(r.playerToken)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setErr(formatError(e));
    }
  }

  function openProfile(playerId) {
    nav(`/dm/app/players/${playerId}/profile`);
  }

  function startEdit(player) {
    setEditPlayer(player);
    setEditName(player?.displayName || "");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editPlayer) return;
    const name = String(editName || "").trim();
    if (!name) return;
    setErr("");
    try {
      await api.dmUpdatePlayer(editPlayer.id, { displayName: name });
      setEditOpen(false);
      setEditPlayer(null);
      await load();
    } catch (e) {
      setErr(formatError(e));
    }
  }

  async function removePlayer(player) {
    if (!player) return;
    if (!window.confirm(`Удалить игрока "${player.displayName}"? Это удалит его инвентарь и профиль.`)) return;
    setErr("");
    try {
      await api.dmDeletePlayer(player.id);
      await load();
    } catch (e) {
      setErr(formatError(e));
    }
  }

  async function kickPlayer(playerId) {
    setErr("");
    try {
      await api.dmKick(playerId);
      await load();
    } catch (e) {
      setErr(formatError(e));
    }
  }

  return (
    <div className="card taped">
      <div style={{ fontWeight: 900, fontSize: 20 }}>Players</div>
      <div className="small">“Как игрок” открывается в режиме read-only</div>
      <hr />
      <ErrorBanner message={err} onRetry={load} />
      <div className="list">
        {players.map((p) => (
          <PlayerDossierCard
            key={p.id}
            player={p}
            rightActions={(
              <>
                <button className="btn" onClick={() => openProfile(p.id)}>Профиль персонажа</button>
                <button className="btn secondary" onClick={() => startEdit(p)}>Редактировать игрока</button>
                <button className="btn secondary" onClick={() => viewAs(p.id)}>Как игрок</button>
                <button className="btn danger" onClick={() => kickPlayer(p.id)}>Kick</button>
                <button className="btn danger" onClick={() => removePlayer(p)}>Удалить</button>
              </>
            )}
          />
        ))}
      </div>

      <Modal open={editOpen} title="Редактировать игрока" onClose={() => setEditOpen(false)}>
        <div className="list">
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Имя игрока"
            style={{ width: "100%" }}
            maxLength={80}
          />
          <button className="btn" onClick={saveEdit}>Сохранить</button>
        </div>
      </Modal>
    </div>
  );
}
