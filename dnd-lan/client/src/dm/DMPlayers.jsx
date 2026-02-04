import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import PlayerDossierCard from "../components/vintage/PlayerDossierCard.jsx";
import Modal from "../components/Modal.jsx";
import ErrorBanner from "../components/ui/ErrorBanner.jsx";
import { formatError } from "../lib/formatError.js";
import { useSocket } from "../context/SocketContext.jsx";

export default function DMPlayers() {
  const [players, setPlayers] = useState([]);
  const [tickets, setTickets] = useState({});
  const [err, setErr] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editPlayer, setEditPlayer] = useState(null);
  const [editName, setEditName] = useState("");
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketPlayer, setTicketPlayer] = useState(null);
  const [ticketDelta, setTicketDelta] = useState("");
  const [ticketSet, setTicketSet] = useState("");
  const [ticketReason, setTicketReason] = useState("");
  const nav = useNavigate();
  const { socket } = useSocket();

  const load = useCallback(async () => {
    setErr("");
    try {
      const [r, t] = await Promise.all([api.dmPlayers(), api.dmTicketsList()]);
      setPlayers(r.items || []);
      const map = {};
      for (const row of t.items || []) map[row.playerId] = row;
      setTickets(map);
    } catch (e) {
      setErr(formatError(e));
    }
  }, []);

  useEffect(() => {
    if (!socket) return () => {};
    load().catch(() => {});
    const onPlayers = () => load().catch(() => {});
    const onStatus = () => load().catch(() => {});
    const onTickets = () => load().catch(() => {});
    socket.on("players:updated", onPlayers);
    socket.on("player:statusChanged", onStatus);
    socket.on("tickets:updated", onTickets);
    return () => {
      socket.off("players:updated", onPlayers);
      socket.off("player:statusChanged", onStatus);
      socket.off("tickets:updated", onTickets);
    };
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

  function openTickets(player) {
    setTicketPlayer(player);
    setTicketDelta("");
    setTicketSet("");
    setTicketReason("");
    setTicketOpen(true);
  }

  async function applyTickets() {
    if (!ticketPlayer) return;
    const delta = Number(ticketDelta || 0);
    const setVal = ticketSet === "" ? null : Number(ticketSet);
    if (Number.isNaN(delta) || Number.isNaN(setVal)) {
      setErr("Неверное значение билетов.");
      return;
    }
    if (setVal == null && !delta) return;
    setErr("");
    try {
      await api.dmTicketsAdjust({
        playerId: ticketPlayer.id,
        delta,
        set: setVal == null ? undefined : setVal,
        reason: ticketReason
      });
      setTicketOpen(false);
      setTicketPlayer(null);
      await load();
    } catch (e) {
      setErr(formatError(e));
    }
  }

  const playersWithTickets = useMemo(() => {
    return (players || []).map((p) => {
      const t = tickets[p.id] || {};
      return { ...p, ticketBalance: Number(t.balance || 0), ticketStreak: Number(t.streak || 0) };
    });
  }, [players, tickets]);

  return (
    <div className="card taped">
      <div style={{ fontWeight: 900, fontSize: 20 }}>Players</div>
      <div className="small">“Как игрок” открывается в режиме read-only</div>
      <hr />
      <ErrorBanner message={err} onRetry={load} />
      <div className="list">
        {playersWithTickets.map((p) => (
          <PlayerDossierCard
            key={p.id}
            player={p}
            ticketBalance={p.ticketBalance}
            ticketStreak={p.ticketStreak}
            rightActions={(
              <>
                <button className="btn" onClick={() => openProfile(p.id)}>Профиль персонажа</button>
                <button className="btn secondary" onClick={() => openTickets(p)}>Билеты</button>
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

      <Modal open={ticketOpen} title="Билеты игрока" onClose={() => setTicketOpen(false)}>
        <div className="list">
          <div className="small">
            Игрок: <b>{ticketPlayer?.displayName || "—"}</b>
          </div>
          <div className="badge">Баланс: {ticketPlayer ? (tickets[ticketPlayer.id]?.balance ?? 0) : 0}</div>
          <div className="small">Серия побед: {ticketPlayer ? (tickets[ticketPlayer.id]?.streak ?? 0) : 0}</div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <button className="btn secondary" onClick={() => setTicketDelta("1")}>+1</button>
            <button className="btn secondary" onClick={() => setTicketDelta("3")}>+3</button>
            <button className="btn secondary" onClick={() => setTicketDelta("-1")}>-1</button>
            <button className="btn secondary" onClick={() => setTicketDelta("-3")}>-3</button>
          </div>
          <input
            value={ticketDelta}
            onChange={(e) => setTicketDelta(e.target.value)}
            placeholder="Дельта (например 2 или -2)"
            style={{ width: "100%" }}
          />
          <input
            value={ticketSet}
            onChange={(e) => setTicketSet(e.target.value)}
            placeholder="Установить баланс (опционально)"
            style={{ width: "100%" }}
          />
          <input
            value={ticketReason}
            onChange={(e) => setTicketReason(e.target.value)}
            placeholder="Причина (опционально)"
            style={{ width: "100%" }}
            maxLength={120}
          />
          <button className="btn" onClick={applyTickets}>Применить</button>
        </div>
      </Modal>
    </div>
  );
}
