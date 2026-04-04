import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import PlayerDossierCard from "../components/vintage/PlayerDossierCard.jsx";
import VirtualizedStack from "../components/VirtualizedStack.jsx";
import Modal from "../components/Modal.jsx";
import { formatError } from "../lib/formatError.js";
import { useSocket } from "../context/SocketContext.jsx";
import { useReadOnly } from "../hooks/useReadOnly.js";
import PlayerStatusPill from "../components/PlayerStatusPill.jsx";
import { useQueryState } from "../hooks/useQueryState.js";
import { useQuickAccess } from "../lib/useQuickAccess.js";
import { useSavedFilters } from "../lib/useSavedFilters.js";
import { t } from "../i18n/index.js";
import { ActionMenu, ConfirmDialog, ErrorBanner, FilterBar, PageHeader, SectionCard, StatusBanner } from "../foundation/primitives/index.js";
import { createImpersonationHandoffUrl } from "../lib/impersonationHandoff.js";

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
  const [bulkTicketOpen, setBulkTicketOpen] = useState(false);
  const [bulkTicketDelta, setBulkTicketDelta] = useState("");
  const [bulkTicketReason, setBulkTicketReason] = useState("");
  const [bulkTicketBusy, setBulkTicketBusy] = useState(false);
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
      const url = createImpersonationHandoffUrl(response.playerToken);
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
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
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

  async function applyBulkTickets() {
    if (readOnly) return;
    const delta = Number(bulkTicketDelta || 0);
    if (Number.isNaN(delta) || !delta) {
      setErr("Укажите ненулевое изменение билетов");
      return;
    }
    const targets = filtered;
    if (!targets.length) return;
    setErr("");
    setBulkTicketBusy(true);
    try {
      for (const player of targets) {
        await api.dmTicketsAdjust({
          playerId: player.id,
          delta,
          reason: bulkTicketReason
        });
      }
      setBulkTicketOpen(false);
      setBulkTicketDelta("");
      setBulkTicketReason("");
      await loadAll();
    } catch (error) {
      setErr(formatError(error));
    } finally {
      setBulkTicketBusy(false);
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

  const quickAccess = useQuickAccess("dm_players", playersWithTickets);
  const { pinnedItems, recentItems, isPinned, togglePinned, trackRecent } = quickAccess;
  const savedFilters = useSavedFilters("dm_players");

  const selectedId = Number(selectedIdParam || 0);
  const selectedPlayer = useMemo(() => {
    return playersWithTickets.find((player) => player.id === selectedId) || null;
  }, [playersWithTickets, selectedId]);

  useEffect(() => {
    if (!selectedPlayer?.id) return;
    trackRecent(selectedPlayer.id);
  }, [selectedPlayer?.id, trackRecent]);

  const filtered = useMemo(() => {
    const query = String(q || "").toLowerCase().trim();
    return playersWithTickets.filter((player) => {
      const status = String(player.status || "offline");
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!query) return true;
      return String(player.displayName || "").toLowerCase().includes(query);
    });
  }, [playersWithTickets, q, statusFilter]);

  const statusCounts = useMemo(() => {
    return playersWithTickets.reduce(
      (acc, player) => {
        const status = String(player.status || "offline");
        if (status === "online") acc.online += 1;
        else if (status === "idle") acc.idle += 1;
        else acc.offline += 1;
        return acc;
      },
      { online: 0, idle: 0, offline: 0 }
    );
  }, [playersWithTickets]);

  const currentFilterLabel = useMemo(() => {
    const parts = [];
    if (statusFilter !== "all") parts.push(`Статус: ${statusFilter}`);
    if (q.trim()) parts.push(`Поиск: ${q.trim()}`);
    return parts.length ? parts.join(" • ") : "Все игроки";
  }, [q, statusFilter]);

  const selectedSummary = useMemo(() => {
    if (!selectedPlayer) return null;
    const hasProfile = Boolean(selectedPlayer.profileExists);
    const statusKey = String(selectedPlayer.status || "offline");
    return {
      hasProfile,
      statusLabel: t(`playerStatus.${statusKey}`),
      lastSeenLabel: selectedPlayer.lastSeen ? new Date(selectedPlayer.lastSeen).toLocaleString() : "Нет данных"
    };
  }, [selectedPlayer]);

  return (
    <>
      <div className="two-pane dm-players-board" data-detail={selectedPlayer ? "1" : "0"}>
        <div className="pane pane-list">
          <div className="card taped tf-shell tf-dm-players-shell">
            <PageHeader
              title={t("dmPlayers.title")}
              subtitle={t("dmPlayers.subtitle")}
            />
            <hr />
            {readOnly ? <StatusBanner tone="warning">{t("dmPlayers.readOnly")}</StatusBanner> : null}
            <ErrorBanner message={err} onRetry={loadAll} />
            <div className="dm-players-summary tf-stat-grid">
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
            {(pinnedItems.length || recentItems.length) ? (
              <div className="tf-panel dm-quick-access">
                <div className="tf-section-kicker">Quick access</div>
                {pinnedItems.length ? (
                  <div className="dm-quick-access-group">
                    <div className="small">Закреплённые</div>
                    <div className="dm-quick-access-chips">
                      {pinnedItems.map((player) => (
                        <button key={`pin-${player.id}`} className="btn secondary dm-quick-access-chip is-pinned" onClick={() => selectPlayer(player.id)}>
                          {player.displayName}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {recentItems.length ? (
                  <div className="dm-quick-access-group">
                    <div className="small">Недавние</div>
                    <div className="dm-quick-access-chips">
                      {recentItems.map((player) => (
                        <button key={`recent-${player.id}`} className="btn secondary dm-quick-access-chip" onClick={() => selectPlayer(player.id)}>
                          {player.displayName}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="tf-panel tf-command-bar dm-players-toolbar">
              <div className="tf-section-copy">
                <div className="tf-section-kicker">Roster filters</div>
                <div className="dm-players-toolbar-title">Поиск и статусы</div>
              </div>
              <FilterBar className="u-mb-0 dm-players-filterbar">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("dmPlayers.searchPlaceholder")}
                  aria-label={t("dmPlayers.searchPlaceholder")}
                  className="u-w-min-360"
                />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label={t("dmPlayers.statusAll")} className="u-w-180">
                  <option value="all">{t("dmPlayers.statusAll")}</option>
                  <option value="online">{t("dmPlayers.statusOnline")}</option>
                  <option value="idle">{t("dmPlayers.statusIdle")}</option>
                  <option value="offline">{t("dmPlayers.statusOffline")}</option>
                </select>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => savedFilters.savePreset(currentFilterLabel, { q, statusFilter })}
                >
                  Сохранить фильтр
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setBulkTicketOpen(true)}
                  disabled={readOnly || !filtered.length}
                >
                  Билеты группе
                </button>
              </FilterBar>
            </div>
            {savedFilters.hasPresets ? (
              <div className="dm-saved-filters">
                {savedFilters.presets.map((preset) => (
                  <div key={preset.id} className="dm-saved-filters-item">
                    <button
                      type="button"
                      className="dm-quick-access-chip"
                      onClick={() => {
                        setQ(String(preset.values?.q || ""));
                        setStatusFilter(String(preset.values?.statusFilter || "all"));
                      }}
                    >
                      {preset.label}
                    </button>
                    <button
                      type="button"
                      className="dm-saved-filters-remove"
                      onClick={() => savedFilters.removePreset(preset.id)}
                      aria-label={`Удалить фильтр ${preset.label}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <VirtualizedStack
              className="list dm-players-roster"
              items={filtered}
              estimateSize={164}
              rowGap={14}
              staticThreshold={20}
              getItemKey={(player) => player.id}
              renderItem={(player) => (
                <PlayerDossierCard
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
                        { label: isPinned(player.id) ? "Убрать из закреплённых" : "Закрепить", onClick: () => togglePinned(player.id) },
                        { label: t("dmPlayers.menuTickets"), onClick: () => openTickets(player), disabled: readOnly },
                        { label: t("dmPlayers.menuEditName"), onClick: () => startEdit(player), disabled: readOnly },
                        { label: t("dmPlayers.menuAsPlayer"), onClick: () => viewAs(player.id), disabled: readOnly },
                        { label: t("dmPlayers.menuKick"), onClick: () => kickPlayer(player.id), disabled: readOnly, tone: "danger" },
                        { label: t("dmPlayers.menuDelete"), onClick: () => requestRemove(player), disabled: readOnly, tone: "danger" }
                      ]}
                    />
                  )}
                />
              )}
            />
          </div>
        </div>

        <div className="pane pane-detail">
          <div className="card taped pane-sticky tf-panel tf-dm-player-detail">
            {selectedPlayer ? (
              <>
                <div className="dm-player-detail-head tf-page-head">
                  <div className="tf-page-head-main">
                    <div className="tf-overline">Selected operative</div>
                    <div className="tf-page-title dm-player-detail-title">{selectedPlayer.displayName}</div>
                    <div className="small dm-player-detail-meta">
                      {t("dmPlayers.playerMeta", {
                        id: selectedPlayer.id,
                        lastSeen: selectedPlayer.lastSeen ? new Date(selectedPlayer.lastSeen).toLocaleString() : "-"
                      })}
                    </div>
                  </div>
                  <div className="tf-command-actions">
                    <button className="btn secondary" onClick={() => selectPlayer(0)}>{t("dmPlayers.backToList")}</button>
                    <button className="btn" onClick={() => openProfile(selectedPlayer.id)}>{t("dmPlayers.openProfile")}</button>
                  </div>
                </div>
                <hr />
                <div className="dm-player-detail-summary">
                  <button className="btn secondary dm-quick-access-chip" onClick={() => togglePinned(selectedPlayer.id)}>
                    {isPinned(selectedPlayer.id) ? "Убрать из закреплённых" : "Закрепить игрока"}
                  </button>
                  <span className={`badge ${selectedSummary?.hasProfile ? "ok" : "warn"}`}>
                    {selectedSummary?.hasProfile ? "Профиль есть" : "Профиль не создан"}
                  </span>
                  <span className="badge secondary">Последний вход: {selectedSummary?.lastSeenLabel}</span>
                </div>
                <div className="row u-row-wrap dm-player-detail-badges">
                  <PlayerStatusPill status={selectedPlayer.status} />
                  <span className="badge">{t("dmPlayers.ticketsBadge", { value: selectedPlayer.ticketBalance ?? 0 })}</span>
                  <span className="badge secondary">{t("dmPlayers.streakBadge", { value: selectedPlayer.ticketStreak ?? 0 })}</span>
                </div>
                <div className="dm-player-detail-grid">
                  <div className="tf-stat-card">
                    <div className="small">Статус</div>
                    <strong>{selectedSummary?.statusLabel}</strong>
                  </div>
                  <div className="tf-stat-card">
                    <div className="small">Билеты</div>
                    <strong>{selectedPlayer.ticketBalance ?? 0}</strong>
                  </div>
                  <div className="tf-stat-card">
                    <div className="small">Серия</div>
                    <strong>{selectedPlayer.ticketStreak ?? 0}</strong>
                  </div>
                </div>
                <div className="paper-note dm-player-quick-links">
                  <div className="title">Быстрые переходы</div>
                  <div className="small">Открой профиль для детального редактирования или зайди как игрок только для просмотра.</div>
                </div>
                <div className="list u-list-mt-12 dm-player-action-list">
                  <button className="btn secondary" onClick={() => openTickets(selectedPlayer)} disabled={readOnly}>{t("dmPlayers.menuTickets")}</button>
                  <button className="btn secondary" onClick={() => startEdit(selectedPlayer)} disabled={readOnly}>{t("dmPlayers.menuEditName")}</button>
                  <button className="btn secondary" onClick={() => viewAs(selectedPlayer.id)} disabled={readOnly}>{t("dmPlayers.menuAsPlayer")}</button>
                  <button className="btn danger" onClick={() => kickPlayer(selectedPlayer.id)} disabled={readOnly}>{t("dmPlayers.menuKick")}</button>
                  <button className="btn danger" onClick={() => requestRemove(selectedPlayer)} disabled={readOnly}>{t("dmPlayers.menuDelete")}</button>
                </div>
              </>
            ) : (
              <div className="dm-player-empty">
                <div className="tf-overline">Control panel</div>
                <div className="dm-player-detail-title">Выбор игрока</div>
                <div className="small">{t("dmPlayers.pickPlayerHint")}</div>
                <div className="dm-player-empty-summary tf-stat-grid">
                  <div className="tf-stat-card">
                    <div className="small">Всего игроков</div>
                    <strong>{playersWithTickets.length}</strong>
                  </div>
                  <div className="tf-stat-card">
                    <div className="small">С профилем</div>
                    <strong>{playersWithTickets.filter((player) => player.profileExists).length}</strong>
                  </div>
                </div>
                <div className="paper-note dm-player-empty-note">
                  <div className="title">Что доступно справа</div>
                  <div className="small">После выбора игрока появятся быстрые действия, состояние профиля, билеты и переход в карточку игрока.</div>
                </div>
              </div>
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
            aria-label={t("dmPlayers.editPlaceholder")}
            className="u-w-full"
            maxLength={80}
            disabled={readOnly}
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
              aria-label={t("dmPlayers.ticketDelta")}
              className="u-w-full"
              disabled={readOnly}
            />
            <input
              value={ticketSet}
              onChange={(e) => setTicketSet(e.target.value)}
              placeholder={t("dmPlayers.ticketSet")}
              aria-label={t("dmPlayers.ticketSet")}
              className="u-w-full"
              disabled={readOnly}
            />
            <input
              value={ticketReason}
              onChange={(e) => setTicketReason(e.target.value)}
              placeholder={t("dmPlayers.ticketReason")}
              aria-label={t("dmPlayers.ticketReason")}
              className="u-w-full"
              maxLength={120}
              disabled={readOnly}
            />
            <button className="btn" onClick={applyTickets} disabled={readOnly}>{t("dmPlayers.ticketApply")}</button>
          </div>
        </SectionCard>
      </Modal>

      <Modal open={bulkTicketOpen} title="Массовая корректировка билетов" onClose={() => setBulkTicketOpen(false)}>
        <SectionCard
          title="Билеты по фильтру"
          subtitle={`Будет изменено игроков: ${filtered.length}`}
        >
          <div className="small">Применяет изменение ко всем игрокам в текущем отфильтрованном списке.</div>
          <FilterBar className="u-mt-10">
            <button className="btn secondary" onClick={() => setBulkTicketDelta("1")} disabled={readOnly || bulkTicketBusy}>+1</button>
            <button className="btn secondary" onClick={() => setBulkTicketDelta("3")} disabled={readOnly || bulkTicketBusy}>+3</button>
            <button className="btn secondary" onClick={() => setBulkTicketDelta("-1")} disabled={readOnly || bulkTicketBusy}>-1</button>
            <button className="btn secondary" onClick={() => setBulkTicketDelta("-3")} disabled={readOnly || bulkTicketBusy}>-3</button>
          </FilterBar>
          <div className="list u-mt-10">
            <input
              value={bulkTicketDelta}
              onChange={(e) => setBulkTicketDelta(e.target.value)}
              placeholder="Изменение билетов"
              aria-label="Массовое изменение билетов"
              className="u-w-full"
              disabled={readOnly || bulkTicketBusy}
            />
            <input
              value={bulkTicketReason}
              onChange={(e) => setBulkTicketReason(e.target.value)}
              placeholder="Причина"
              aria-label="Причина массового изменения"
              className="u-w-full"
              maxLength={120}
              disabled={readOnly || bulkTicketBusy}
            />
            <button className="btn" onClick={applyBulkTickets} disabled={readOnly || bulkTicketBusy || !filtered.length}>
              {bulkTicketBusy ? "Применяю..." : "Применить ко всем"}
            </button>
          </div>
        </SectionCard>
      </Modal>
    </>
  );
}
