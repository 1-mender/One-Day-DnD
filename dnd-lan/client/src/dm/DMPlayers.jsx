import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import PlayerDossierCard from "../components/vintage/PlayerDossierCard.jsx";
import Modal from "../components/Modal.jsx";
import ErrorBanner from "../components/ui/ErrorBanner.jsx";
import ActionMenu from "../components/ui/ActionMenu.jsx";
import { formatError } from "../lib/formatError.js";
import { useSocket } from "../context/SocketContext.jsx";
import { useReadOnly } from "../hooks/useReadOnly.js";
import PlayerStatusPill from "../components/PlayerStatusPill.jsx";
import { useQueryState } from "../hooks/useQueryState.js";

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
  const [q, setQ] = useQueryState("q", "");
  const [statusFilter, setStatusFilter] = useQueryState("status", "all");
  const [selectedIdParam, setSelectedIdParam] = useQueryState("id", "");
  const nav = useNavigate();
  const { socket } = useSocket();
  const readOnly = useReadOnly();

  const loadPlayers = useCallback(async () => {
    setErr("");
    try {
      const r = await api.dmPlayers();
      setPlayers(r.items || []);
    } catch (e) {
      setErr(formatError(e));
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setErr("");
    try {
      const t = await api.dmTicketsList();
      const map = {};
      for (const row of t.items || []) map[row.playerId] = row;
      setTickets(map);
    } catch (e) {
      setErr(formatError(e));
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadPlayers(), loadTickets()]);
  }, [loadPlayers, loadTickets]);

  useEffect(() => {
    if (!socket) return () => {};
    loadAll().catch(() => {});
    const onPlayers = () => loadPlayers().catch(() => {});
    const onStatus = () => loadPlayers().catch(() => {});
    const onTickets = () => loadTickets().catch(() => {});
    const onInventory = () => loadPlayers().catch(() => {});
    socket.on("players:updated", onPlayers);
    socket.on("player:statusChanged", onStatus);
    socket.on("tickets:updated", onTickets);
    socket.on("inventory:updated", onInventory);
    return () => {
      socket.off("players:updated", onPlayers);
      socket.off("player:statusChanged", onStatus);
      socket.off("tickets:updated", onTickets);
      socket.off("inventory:updated", onInventory);
    };
  }, [loadAll, loadPlayers, loadTickets, socket]);

  async function viewAs(playerId) {
    if (readOnly) return;
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

  function selectPlayer(playerId) {
    if (!playerId) setSelectedIdParam("");
    else setSelectedIdParam(String(playerId));
  }

  function startEdit(player) {
    setEditPlayer(player);
    setEditName(player?.displayName || "");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (readOnly) return;
    if (!editPlayer) return;
    const name = String(editName || "").trim();
    if (!name) return;
    setErr("");
    try {
      await api.dmUpdatePlayer(editPlayer.id, { displayName: name });
      setEditOpen(false);
      setEditPlayer(null);
      await loadPlayers();
    } catch (e) {
      setErr(formatError(e));
    }
  }

  async function removePlayer(player) {
    if (readOnly) return;
    if (!player) return;
    if (!window.confirm(`Удалить игрока "${player.displayName}"? Это удалит его инвентарь и профиль.`)) return;
    setErr("");
    try {
      await api.dmDeletePlayer(player.id);
      await loadPlayers();
    } catch (e) {
      setErr(formatError(e));
    }
  }

  async function kickPlayer(playerId) {
    if (readOnly) return;
    setErr("");
    try {
      await api.dmKick(playerId);
      await loadPlayers();
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
    if (readOnly) return;
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
      await loadAll();
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

  const selectedId = Number(selectedIdParam || 0);
  const selectedPlayer = useMemo(() => {
    return playersWithTickets.find((p) => p.id === selectedId) || null;
  }, [playersWithTickets, selectedId]);

  const filtered = useMemo(() => {
    const qq = String(q || "").toLowerCase().trim();
    return playersWithTickets.filter((p) => {
      const status = String(p.status || "offline");
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!qq) return true;
      return String(p.displayName || "").toLowerCase().includes(qq);
    });
  }, [playersWithTickets, q, statusFilter]);

  return (
    <>
    <div className="two-pane" data-detail={selectedPlayer ? "1" : "0"}>
      <div className="pane pane-list">
        <div className="card taped">
          <div style={{ fontWeight: 900, fontSize: 20 }}>Players</div>
          <div className="small">Quick view of player status and actions</div>
          <hr />
          {readOnly ? <div className="badge warn">Read-only: write disabled</div> : null}
          <ErrorBanner message={err} onRetry={loadAll} />
          <div className="row" style={{ flexWrap: "wrap", marginBottom: 8 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search players..."
              style={{ width: "min(360px, 100%)" }}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 180 }}>
              <option value="all">Status: all</option>
              <option value="online">Online</option>
              <option value="idle">Idle</option>
              <option value="offline">Offline</option>
            </select>
          </div>
          <div className="list">
            {filtered.map((p) => (
              <PlayerDossierCard
                key={p.id}
                player={p}
                ticketBalance={p.ticketBalance}
                ticketStreak={p.ticketStreak}
                selected={p.id === selectedId}
                onClick={() => selectPlayer(p.id)}
                menu={(
                  <ActionMenu
                    items={[
                      { label: "Open profile", onClick: () => openProfile(p.id) },
                      { label: "Tickets", onClick: () => openTickets(p), disabled: readOnly },
                      { label: "Edit name", onClick: () => startEdit(p), disabled: readOnly },
                      { label: "View as player", onClick: () => viewAs(p.id), disabled: readOnly },
                      { label: "Kick", onClick: () => kickPlayer(p.id), disabled: readOnly, tone: "danger" },
                      { label: "Delete", onClick: () => removePlayer(p), disabled: readOnly, tone: "danger" }
                    ]}
                  />
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="pane pane-detail">
        <div className="card taped">
          {selectedPlayer ? (
            <>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 20 }}>{selectedPlayer.displayName}</div>
                  <div className="small">
                    id: {selectedPlayer.id} - lastSeen: {selectedPlayer.lastSeen ? new Date(selectedPlayer.lastSeen).toLocaleString() : "-"}
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn secondary" onClick={() => selectPlayer(0)}>Back to list</button>
                  <button className="btn" onClick={() => openProfile(selectedPlayer.id)}>Open profile</button>
                </div>
              </div>
              <hr />
              <div className="row" style={{ flexWrap: "wrap" }}>
                <PlayerStatusPill status={selectedPlayer.status} />
                <span className="badge">Tickets: {selectedPlayer.ticketBalance ?? 0}</span>
                <span className="badge secondary">Streak: {selectedPlayer.ticketStreak ?? 0}</span>
              </div>
              <div className="list" style={{ marginTop: 12 }}>
                <button className="btn secondary" onClick={() => openTickets(selectedPlayer)} disabled={readOnly}>Tickets</button>
                <button className="btn secondary" onClick={() => startEdit(selectedPlayer)} disabled={readOnly}>Edit name</button>
                <button className="btn secondary" onClick={() => viewAs(selectedPlayer.id)} disabled={readOnly}>View as player</button>
                <button className="btn danger" onClick={() => kickPlayer(selectedPlayer.id)} disabled={readOnly}>Kick</button>
                <button className="btn danger" onClick={() => removePlayer(selectedPlayer)} disabled={readOnly}>Delete</button>
              </div>
            </>
          ) : (
            <div className="small">Select a player to see details.</div>
          )}
        </div>
      </div>
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
          <button className="btn" onClick={saveEdit} disabled={readOnly}>Сохранить</button>
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
            <button className="btn secondary" onClick={() => setTicketDelta("1")} disabled={readOnly}>+1</button>
            <button className="btn secondary" onClick={() => setTicketDelta("3")} disabled={readOnly}>+3</button>
            <button className="btn secondary" onClick={() => setTicketDelta("-1")} disabled={readOnly}>-1</button>
            <button className="btn secondary" onClick={() => setTicketDelta("-3")} disabled={readOnly}>-3</button>
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
          <button className="btn" onClick={applyTickets} disabled={readOnly}>Применить</button>
        </div>
      </Modal>
    </>
  );
}
