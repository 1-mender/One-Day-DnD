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
import { t } from "../i18n/index.js";
import { ConfirmDialog, FilterBar, PageHeader, SectionCard, StatusBanner } from "../foundation/primitives/index.js";

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
  const [removeTarget, setRemoveTarget] = useState(null);
  const [q, setQ] = useQueryState("q", "");
  const [statusFilter, setStatusFilter] = useQueryState("status", "all");
  const [selectedIdParam, setSelectedIdParam] = useQueryState("id", "");
  const nav = useNavigate();
  const { socket } = useSocket();
  const readOnly = useReadOnly();

  const loadPlayers = useCallback(async () => {
    setErr("");
    try {
      const response = await api.dmPlayers();
      setPlayers(response.items || []);
    } catch (error) {
      setErr(formatError(error));
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setErr("");
    try {
      const response = await api.dmTicketsList();
      const map = {};
      for (const row of response.items || []) map[row.playerId] = row;
      setTickets(map);
    } catch (error) {
      setErr(formatError(error));
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
      const response = await api.dmImpersonate(playerId, "ro");
      const url = `/app?imp=1&token=${encodeURIComponent(response.playerToken)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErr(formatError(error));
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
    } catch (error) {
      setErr(formatError(error));
    }
  }

  function requestRemove(player) {
    if (readOnly || !player) return;
    setRemoveTarget(player);
  }

  async function confirmRemovePlayer() {
    if (!removeTarget) return;
    setErr("");
    try {
      await api.dmDeletePlayer(removeTarget.id);
      setRemoveTarget(null);
      await loadPlayers();
    } catch (error) {
      setErr(formatError(error));
    }
  }

  async function kickPlayer(playerId) {
    if (readOnly) return;
    setErr("");
    try {
      await api.dmKick(playerId);
      await loadPlayers();
    } catch (error) {
      setErr(formatError(error));
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
    if (readOnly || !ticketPlayer) return;
    const delta = Number(ticketDelta || 0);
    const setValue = ticketSet === "" ? null : Number(ticketSet);
    if (Number.isNaN(delta) || Number.isNaN(setValue)) {
      setErr(t("dmPlayers.ticketInvalidValue"));
      return;
    }
    if (setValue == null && !delta) return;
    setErr("");
    try {
      await api.dmTicketsAdjust({
        playerId: ticketPlayer.id,
        delta,
        set: setValue == null ? undefined : setValue,
        reason: ticketReason
      });
      setTicketOpen(false);
      setTicketPlayer(null);
      await loadAll();
    } catch (error) {
      setErr(formatError(error));
    }
  }

  const playersWithTickets = useMemo(() => {
    return (players || []).map((player) => {
      const ticketData = tickets[player.id] || {};
      return {
        ...player,
        ticketBalance: Number(ticketData.balance || 0),
        ticketStreak: Number(ticketData.streak || 0)
      };
    });
  }, [players, tickets]);

  const selectedId = Number(selectedIdParam || 0);
  const selectedPlayer = useMemo(() => {
    return playersWithTickets.find((player) => player.id === selectedId) || null;
  }, [playersWithTickets, selectedId]);

  const filtered = useMemo(() => {
    const query = String(q || "").toLowerCase().trim();
    return playersWithTickets.filter((player) => {
      const status = String(player.status || "offline");
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!query) return true;
      return String(player.displayName || "").toLowerCase().includes(query);
    });
  }, [playersWithTickets, q, statusFilter]);

  return (
    <>
      <div className="two-pane" data-detail={selectedPlayer ? "1" : "0"}>
        <div className="pane pane-list">
          <div className="card taped">
            <PageHeader
              title={t("dmPlayers.title")}
              subtitle={t("dmPlayers.subtitle")}
            />
            <hr />
            {readOnly ? <StatusBanner tone="warning">{t("dmPlayers.readOnly")}</StatusBanner> : null}
            <ErrorBanner message={err} onRetry={loadAll} />
            <FilterBar className="u-mb-8">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("dmPlayers.searchPlaceholder")}
                className="u-w-min-360"
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="u-w-180">
                <option value="all">{t("dmPlayers.statusAll")}</option>
                <option value="online">{t("dmPlayers.statusOnline")}</option>
                <option value="idle">{t("dmPlayers.statusIdle")}</option>
                <option value="offline">{t("dmPlayers.statusOffline")}</option>
              </select>
            </FilterBar>
            <div className="list">
              {filtered.map((player) => (
                <PlayerDossierCard
                  key={player.id}
                  player={player}
                  ticketBalance={player.ticketBalance}
                  ticketStreak={player.ticketStreak}
                  selected={player.id === selectedId}
                  onClick={() => selectPlayer(player.id)}
                  menu={(
                    <ActionMenu
                      label={t("dmPlayers.menuLabel")}
                      items={[
                        { label: t("dmPlayers.menuOpenProfile"), onClick: () => openProfile(player.id) },
                        { label: t("dmPlayers.menuTickets"), onClick: () => openTickets(player), disabled: readOnly },
                        { label: t("dmPlayers.menuEditName"), onClick: () => startEdit(player), disabled: readOnly },
                        { label: t("dmPlayers.menuAsPlayer"), onClick: () => viewAs(player.id), disabled: readOnly },
                        { label: t("dmPlayers.menuKick"), onClick: () => kickPlayer(player.id), disabled: readOnly, tone: "danger" },
                        { label: t("dmPlayers.menuDelete"), onClick: () => requestRemove(player), disabled: readOnly, tone: "danger" }
                      ]}
                    />
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="pane pane-detail">
          <div className="card taped pane-sticky">
            {selectedPlayer ? (
              <>
                <PageHeader
                  title={selectedPlayer.displayName}
                  subtitle={t("dmPlayers.playerMeta", {
                    id: selectedPlayer.id,
                    lastSeen: selectedPlayer.lastSeen ? new Date(selectedPlayer.lastSeen).toLocaleString() : "-"
                  })}
                  actions={(
                    <>
                      <button className="btn secondary" onClick={() => selectPlayer(0)}>{t("dmPlayers.backToList")}</button>
                      <button className="btn" onClick={() => openProfile(selectedPlayer.id)}>{t("dmPlayers.openProfile")}</button>
                    </>
                  )}
                />
                <hr />
                <div className="row u-row-wrap">
                  <PlayerStatusPill status={selectedPlayer.status} />
                  <span className="badge">{t("dmPlayers.ticketsBadge", { value: selectedPlayer.ticketBalance ?? 0 })}</span>
                  <span className="badge secondary">{t("dmPlayers.streakBadge", { value: selectedPlayer.ticketStreak ?? 0 })}</span>
                </div>
                <div className="list u-list-mt-12">
                  <button className="btn secondary" onClick={() => openTickets(selectedPlayer)} disabled={readOnly}>{t("dmPlayers.menuTickets")}</button>
                  <button className="btn secondary" onClick={() => startEdit(selectedPlayer)} disabled={readOnly}>{t("dmPlayers.menuEditName")}</button>
                  <button className="btn secondary" onClick={() => viewAs(selectedPlayer.id)} disabled={readOnly}>{t("dmPlayers.menuAsPlayer")}</button>
                  <button className="btn danger" onClick={() => kickPlayer(selectedPlayer.id)} disabled={readOnly}>{t("dmPlayers.menuKick")}</button>
                  <button className="btn danger" onClick={() => requestRemove(selectedPlayer)} disabled={readOnly}>{t("dmPlayers.menuDelete")}</button>
                </div>
              </>
            ) : (
              <div className="small">{t("dmPlayers.pickPlayerHint")}</div>
            )}
          </div>
        </div>
      </div>

      <Modal open={editOpen} title={t("dmPlayers.editTitle")} onClose={() => setEditOpen(false)}>
        <div className="list">
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder={t("dmPlayers.editPlaceholder")}
            className="u-w-full"
            maxLength={80}
          />
          <button className="btn" onClick={saveEdit} disabled={readOnly}>{t("common.save")}</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!removeTarget}
        title={t("dmPlayers.removeTitle")}
        message={t("dmPlayers.removeBody", { name: removeTarget?.displayName || t("common.notAvailable") })}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={confirmRemovePlayer}
        confirmDisabled={readOnly}
        confirmLabel={t("dmPlayers.menuDelete")}
      />

      <Modal open={ticketOpen} title={t("dmPlayers.ticketTitle")} onClose={() => setTicketOpen(false)}>
        <SectionCard
          title={t("dmPlayers.ticketSectionTitle")}
          subtitle={t("dmPlayers.ticketFor", { name: ticketPlayer?.displayName || t("common.notAvailable") })}
        >
          <div className="badge">{t("dmPlayers.ticketBalance", { value: ticketPlayer ? (tickets[ticketPlayer.id]?.balance ?? 0) : 0 })}</div>
          <div className="small u-mt-6">{t("dmPlayers.ticketStreak", { value: ticketPlayer ? (tickets[ticketPlayer.id]?.streak ?? 0) : 0 })}</div>
          <FilterBar className="u-mt-10">
            <button className="btn secondary" onClick={() => setTicketDelta("1")} disabled={readOnly}>+1</button>
            <button className="btn secondary" onClick={() => setTicketDelta("3")} disabled={readOnly}>+3</button>
            <button className="btn secondary" onClick={() => setTicketDelta("-1")} disabled={readOnly}>-1</button>
            <button className="btn secondary" onClick={() => setTicketDelta("-3")} disabled={readOnly}>-3</button>
          </FilterBar>
          <div className="list u-mt-10">
            <input
              value={ticketDelta}
              onChange={(e) => setTicketDelta(e.target.value)}
              placeholder={t("dmPlayers.ticketDelta")}
              className="u-w-full"
            />
            <input
              value={ticketSet}
              onChange={(e) => setTicketSet(e.target.value)}
              placeholder={t("dmPlayers.ticketSet")}
              className="u-w-full"
            />
            <input
              value={ticketReason}
              onChange={(e) => setTicketReason(e.target.value)}
              placeholder={t("dmPlayers.ticketReason")}
              className="u-w-full"
              maxLength={120}
            />
            <button className="btn" onClick={applyTickets} disabled={readOnly}>{t("dmPlayers.ticketApply")}</button>
          </div>
        </SectionCard>
      </Modal>
    </>
  );
}
