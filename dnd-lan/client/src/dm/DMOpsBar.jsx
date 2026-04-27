import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";
import QRCodeCard from "../components/QRCodeCard.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { resolveJoinUrl } from "../lib/joinUrl.js";
import { BookOpen, Coins, Copy, Eye, EyeOff, Package2, PlusSquare, QrCode, RefreshCcw, ScrollText, Search, Settings, Users } from "lucide-react";
import { formatError } from "../lib/formatError.js";
import { t } from "../i18n/index.js";
import { useQuickAccess } from "../lib/useQuickAccess.js";

export default function DMOpsBar() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [info, setInfo] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [players, setPlayers] = useState([]);
  const [monsters, setMonsters] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [showQr, setShowQr] = useState(false);
  const [showQuickSwitch, setShowQuickSwitch] = useState(false);
  const [quickQuery, setQuickQuery] = useState("");
  const [quickLoaded, setQuickLoaded] = useState(false);
  const [bestiaryBusy, setBestiaryBusy] = useState(false);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [quickNoteBusy, setQuickNoteBusy] = useState(false);
  const [quickTicketsOpen, setQuickTicketsOpen] = useState(false);
  const [quickTicketsBusy, setQuickTicketsBusy] = useState(false);
  const [quickMsg, setQuickMsg] = useState("");
  const [quickNoteForm, setQuickNoteForm] = useState({ title: "", content: "", access: "all" });
  const [quickTicketScope, setQuickTicketScope] = useState("online");
  const [quickTicketDelta, setQuickTicketDelta] = useState("");
  const [quickTicketReason, setQuickTicketReason] = useState("");
  const [quickTicketSummary, setQuickTicketSummary] = useState(null);
  const [copied, setCopied] = useState({ url: false, code: false });
  const [err, setErr] = useState("");
  const [quickErr, setQuickErr] = useState("");
  const playersRefreshTimerRef = useRef(null);
  const playerQuick = useQuickAccess("dm_players", players);
  const playerProfileQuick = useQuickAccess("dm_player_profiles", players);
  const bestiaryQuick = useQuickAccess("dm_bestiary", monsters);
  const infoQuick = useQuickAccess("dm_info_blocks", blocks);

  const loadInfo = useCallback(async () => {
    const i = await api.serverInfo();
    setInfo(i);
    if (i?.party?.joinCodeEnabled) {
      const r = await api.dmGetJoinCode();
      setJoinCode(String(r?.joinCode || ""));
      return;
    }
    setJoinCode("");
  }, []);

  const loadPlayers = useCallback(async () => {
    const p = await api.dmPlayers();
    setPlayers(p.items || []);
  }, []);

  const loadBlocks = useCallback(async () => {
    const response = await api.infoBlocks();
    const items = response.items || [];
    setBlocks(items);
    return items;
  }, []);

  const load = useCallback(async () => {
    setErr("");
    try {
      await Promise.all([loadInfo(), loadPlayers()]);
    } catch (e) {
      setErr(formatError(e));
    }
  }, [loadInfo, loadPlayers]);

  const loadQuickSwitchData = useCallback(async () => {
    setQuickErr("");
    try {
      const [bestiaryResponse, infoResponse] = await Promise.all([
        api.bestiaryPage({ limit: 200 }),
        api.infoBlocks()
      ]);
      setMonsters(bestiaryResponse.items || []);
      setBlocks(infoResponse.items || []);
      setQuickLoaded(true);
    } catch (e) {
      setQuickErr(formatError(e));
    }
  }, []);

  useEffect(() => {
    if (!socket) return () => {};
    load().catch(() => {});

    const schedulePlayersRefresh = () => {
      if (playersRefreshTimerRef.current != null) return;
      playersRefreshTimerRef.current = setTimeout(() => {
        playersRefreshTimerRef.current = null;
        loadPlayers().catch(() => {});
      }, 150);
    };

    const onPlayers = () => schedulePlayersRefresh();
    const onStatus = (payload) => {
      const playerId = Number(payload?.playerId);
      const status = String(payload?.status || "");
      if (!playerId || !status) return;
      setPlayers((prev) => prev.map((p) => (
        Number(p?.id) === playerId
          ? { ...p, status, lastSeen: Number(payload?.lastSeen || Date.now()) }
          : p
      )));
    };
    const onSettings = () => loadInfo().catch(() => {});

    socket.on("players:updated", onPlayers);
    socket.on("player:statusChanged", onStatus);
    socket.on("settings:updated", onSettings);

    return () => {
      if (playersRefreshTimerRef.current != null) {
        clearTimeout(playersRefreshTimerRef.current);
        playersRefreshTimerRef.current = null;
      }
      socket.off("players:updated", onPlayers);
      socket.off("player:statusChanged", onStatus);
      socket.off("settings:updated", onSettings);
    };
  }, [load, loadInfo, loadPlayers, socket]);

  useEffect(() => {
    if (!showQuickSwitch || quickLoaded) return;
    loadQuickSwitchData().catch(() => {});
  }, [loadQuickSwitchData, quickLoaded, showQuickSwitch]);

  const counts = useMemo(() => {
    return (players || []).reduce((acc, p) => {
      const s = String(p.status || "offline");
      if (s === "online") acc.online += 1;
      else if (s === "idle") acc.idle += 1;
      else acc.offline += 1;
      return acc;
    }, { online: 0, idle: 0, offline: 0 });
  }, [players]);

  const url = resolveJoinUrl(info);
  const joinCodeEnabled = !!info?.party?.joinCodeEnabled;
  const partyName = info?.party?.name;
  const normalizedQuery = String(quickQuery || "").trim().toLowerCase();

  const quickResults = useMemo(() => {
    if (!normalizedQuery) return [];
    const results = [];
    for (const player of players) {
      const hay = [
        player.displayName,
        player.characterName,
        player.classRole,
        player.id
      ].filter(Boolean).join(" ").toLowerCase();
      if (hay.includes(normalizedQuery)) {
        results.push({
          id: `player-${player.id}`,
          type: "Игрок",
          title: player.displayName || `Игрок #${player.id}`,
          subtitle: player.characterName || `id: ${player.id}`,
          onSelect: () => {
            playerQuick.trackRecent(player.id);
            playerProfileQuick.trackRecent(player.id);
            navigate(`/dm/app/players/${player.id}/profile`);
          }
        });
      }
    }
    for (const monster of monsters) {
      const hay = [
        monster.name,
        monster.type,
        monster.environment,
        monster.description
      ].filter(Boolean).join(" ").toLowerCase();
      if (hay.includes(normalizedQuery)) {
        results.push({
          id: `monster-${monster.id}`,
          type: "Монстр",
          title: monster.name || `Монстр #${monster.id}`,
          subtitle: monster.type || monster.environment || "Бестиарий",
          onSelect: () => {
            bestiaryQuick.trackRecent(monster.id);
            navigate(`/dm/app/bestiary?id=${monster.id}`);
          }
        });
      }
    }
    for (const block of blocks) {
      const hay = [
        block.title,
        block.category,
        block.content,
        ...(block.tags || [])
      ].filter(Boolean).join(" ").toLowerCase();
      if (hay.includes(normalizedQuery)) {
        results.push({
          id: `info-${block.id}`,
          type: "Инфоблок",
          title: block.title || `Блок #${block.id}`,
          subtitle: block.category || "Инфоблок",
          onSelect: () => {
            infoQuick.trackRecent(block.id);
            navigate(`/dm/app/info?id=${block.id}`);
          }
        });
      }
    }
    return results.slice(0, 12);
  }, [
    bestiaryQuick,
    blocks,
    infoQuick,
    monsters,
    navigate,
    normalizedQuery,
    playerProfileQuick,
    playerQuick,
    players
  ]);

  const quickNavItems = useMemo(() => ([
    { key: "players", label: "Игроки", icon: Users, onClick: () => navigate("/dm/app/players") },
    { key: "inventory", label: "Инвентарь", icon: Package2, onClick: () => navigate("/dm/app/inventory") },
    { key: "bestiary", label: "Бестиарий", icon: BookOpen, onClick: () => navigate("/dm/app/bestiary") },
    { key: "info", label: "Инфоблоки", icon: ScrollText, onClick: () => navigate("/dm/app/info") },
    { key: "settings", label: "Настройки", icon: Settings, onClick: () => navigate("/dm/app/settings") }
  ]), [navigate]);

  const sceneTemplates = useMemo(() => ([
    {
      key: "hint",
      label: "Подсказка",
      access: "all",
      title: "Подсказка сцены",
      content: "Короткая подсказка для игроков:\n\n- что они замечают\n- на что стоит обратить внимание\n- какой следующий шаг кажется разумным"
    },
    {
      key: "clue",
      label: "Улика",
      access: "all",
      title: "Найдена улика",
      content: "Игроки находят важную улику:\n\n- где она лежит\n- почему она необычна\n- что она может значить для сцены"
    },
    {
      key: "combat",
      label: "Боевое описание",
      access: "all",
      title: "Боевая сцена",
      content: "Краткое описание боевой сцены:\n\n- что слышно и видно\n- где угроза\n- что меняется в обстановке прямо сейчас"
    }
  ]), []);

  const ticketScopeOptions = useMemo(() => ([
    { key: "online", label: "Онлайн", count: players.filter((player) => String(player.status || "") === "online").length },
    { key: "idle", label: "Нет активности", count: players.filter((player) => String(player.status || "") === "idle").length },
    { key: "offline", label: "Оффлайн", count: players.filter((player) => String(player.status || "offline") === "offline").length },
    { key: "all", label: "Все игроки", count: players.length }
  ]), [players]);

  const quickTicketTargets = useMemo(() => {
    if (quickTicketScope === "all") return players;
    return players.filter((player) => String(player.status || "offline") === quickTicketScope);
  }, [players, quickTicketScope]);

  const lastSceneBlock = useMemo(() => {
    if (!blocks.length) return null;
    return [...blocks].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0] || null;
  }, [blocks]);

  const openQuickResult = (result) => {
    result?.onSelect?.();
    setShowQuickSwitch(false);
    setQuickQuery("");
  };

  const toggleBestiaryAccess = async () => {
    if (bestiaryBusy) return;
    setBestiaryBusy(true);
    setErr("");
    try {
      await api.dmBestiaryToggle(!info?.settings?.bestiaryEnabled);
      await loadInfo();
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setBestiaryBusy(false);
    }
  };

  const pushQuickMsg = (text) => {
    setQuickMsg(text);
    setTimeout(() => setQuickMsg(""), 2200);
  };

  const createQuickNote = async () => {
    if (quickNoteBusy) return;
    const title = String(quickNoteForm.title || "").trim();
    const content = String(quickNoteForm.content || "").trim();
    if (!title || !content) {
      setErr("Заполните заголовок и текст инфоблока");
      return;
    }
    setQuickNoteBusy(true);
    setErr("");
    try {
      const created = await api.dmInfoCreate({
        title,
        content,
        category: "note",
        access: quickNoteForm.access,
        selectedPlayerIds: [],
        tags: []
      });
      setQuickNoteOpen(false);
      setQuickNoteForm({ title: "", content: "", access: "all" });
      pushQuickMsg("Инфоблок создан");
      navigate(created?.id ? `/dm/app/info?id=${created.id}` : "/dm/app/info");
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setQuickNoteBusy(false);
    }
  };

  const openQuickNote = (access) => {
    setErr("");
    setQuickNoteForm((prev) => ({
      ...prev,
      access: access || "all"
    }));
    setQuickNoteOpen(true);
  };

  const openQuickTemplate = (template) => {
    if (!template) return;
    setErr("");
    setQuickNoteForm({
      title: template.title,
      content: template.content,
      access: template.access
    });
    setQuickNoteOpen(true);
  };

  const applyQuickTickets = async () => {
    if (quickTicketsBusy) return;
    const delta = Number(quickTicketDelta || 0);
    if (Number.isNaN(delta) || !delta) {
      setErr("Укажите ненулевое изменение билетов");
      return;
    }
    if (!quickTicketTargets.length) {
      setErr("В выбранной группе нет игроков");
      return;
    }
    setQuickTicketsBusy(true);
    setErr("");
    setQuickTicketSummary(null);
    try {
      const response = await api.dmTicketsAdjustBulk({
        playerIds: quickTicketTargets.map((player) => player.id),
        delta,
        reason: quickTicketReason
      });
      setQuickTicketSummary(response);
      if (!response?.failedCount) {
        setQuickTicketsOpen(false);
        setQuickTicketDelta("");
        setQuickTicketReason("");
      }
      await loadPlayers();
      pushQuickMsg(`Билеты изменены: ${response?.appliedCount || 0}${response?.failedCount ? `, ошибок: ${response.failedCount}` : ""}`);
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setQuickTicketsBusy(false);
    }
  };

  const applyQuickTicketReward = async (delta, scope, reason) => {
    const targets = players.filter((player) => scope === "all" || String(player.status || "offline") === scope);
    if (!targets.length) {
      setErr("Нет игроков для быстрого бонуса");
      return;
    }
    setQuickTicketsBusy(true);
    setErr("");
    try {
      const response = await api.dmTicketsAdjustBulk({
        playerIds: targets.map((player) => player.id),
        delta,
        reason
      });
      await loadPlayers();
      pushQuickMsg(`Бонус выдан: ${response?.appliedCount || 0}${response?.failedCount ? `, ошибок: ${response.failedCount}` : ""}`);
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setQuickTicketsBusy(false);
    }
  };

  const updateLastBlockAccess = async (access) => {
    setQuickNoteBusy(true);
    setErr("");
    try {
      const items = blocks.length ? blocks : await loadBlocks();
      const latest = [...items].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
      if (!latest?.id) {
        setErr("Нет инфоблоков для быстрого действия");
        return;
      }
      await api.dmInfoUpdate(latest.id, {
        ...latest,
        access,
        tags: Array.isArray(latest.tags) ? latest.tags : [],
        selectedPlayerIds: access === "selected"
          ? (Array.isArray(latest.selectedPlayerIds) ? latest.selectedPlayerIds.map(Number) : [])
          : []
      });
      await loadBlocks();
      pushQuickMsg(access === "all" ? "Последний блок открыт всем" : "Последний блок скрыт для игроков");
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setQuickNoteBusy(false);
    }
  };

  const copyText = async (text, key) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => setCopied((prev) => ({ ...prev, [key]: false })), 1500);
    } catch {
      setErr(t("dmOps.copyFailed", null, "Не удалось скопировать в буфер обмена."));
    }
  };

  return (
    <div className="dm-ops">
      <div className="dm-ops-row">
        <div className="dm-ops-title">
          {partyName ? t("dmOps.partyLabel", { name: partyName }, `Партия: ${partyName}`) : t("dmOps.title", null, "Управление партией")}
        </div>
        <div className="dm-ops-status">
          <span className="badge ok">{t("dmOps.online", null, "Онлайн")}: {counts.online}</span>
          <span className="badge warn">{t("dmOps.idle", null, "Нет активности")}: {counts.idle}</span>
          <span className="badge off">{t("dmOps.offline", null, "Оффлайн")}: {counts.offline}</span>
        </div>
        <div className="dm-ops-actions">
          <button className="btn secondary" onClick={() => setShowQuickSwitch((value) => !value)} title="Быстрый переход">
            <Search className="icon" aria-hidden="true" />
            Быстрый переход
          </button>
          <button className="btn secondary" onClick={load} title={t("dmOps.refresh", null, "Обновить")}>
            <RefreshCcw className="icon" aria-hidden="true" />
            {t("dmOps.refresh", null, "Обновить")}
          </button>
        </div>
      </div>

      <div className="dm-ops-row">
        <div className="dm-ops-field">
          <div className="dm-ops-label">{t("dmOps.joinUrl", null, "Адрес подключения")}</div>
          <div className="dm-ops-value">{url}</div>
          <div className="dm-ops-actions">
            <button className="btn secondary" onClick={() => copyText(url, "url")}>
              <Copy className="icon" aria-hidden="true" />
              {copied.url ? t("dmOps.copied", null, "Скопировано") : t("dmOps.copyUrl", null, "Копировать адрес")}
            </button>
            <button className="btn secondary" onClick={() => setShowQr((v) => !v)}>
              <QrCode className="icon" aria-hidden="true" />
              {showQr ? t("dmOps.hideQr", null, "Скрыть QR") : t("dmOps.showQr", null, "QR-код")}
            </button>
          </div>
        </div>

        <div className="dm-ops-field">
          <div className="dm-ops-label">{t("dmOps.joinCode", null, "Код партии")}</div>
          <div className="dm-ops-value">
            {joinCodeEnabled ? (joinCode || "-") : t("dmOps.disabled", null, "Отключён")}
          </div>
          <div className="dm-ops-actions">
            <button className="btn secondary" onClick={() => copyText(joinCode, "code")} disabled={!joinCodeEnabled || !joinCode}>
              <Copy className="icon" aria-hidden="true" />
              {copied.code ? t("dmOps.copied", null, "Скопировано") : t("dmOps.copyCode", null, "Копировать код")}
            </button>
          </div>
        </div>
      </div>

      {err ? (
        <div className="badge off u-mt-8">
          {t("common.error")}: {err}
        </div>
      ) : null}
      {quickMsg ? <div className="badge ok u-mt-8">{quickMsg}</div> : null}

      {showQr ? (
        <div className="dm-ops-qr">
          <QRCodeCard url={url} className="compact" />
        </div>
      ) : null}

      <div className="dm-ops-quick-actions">
        <div className="dm-ops-quick-actions-block">
          <div className="tf-section-copy">
            <div className="tf-section-kicker">Quick actions</div>
            <div className="dm-inv-panel-title">Быстрые действия</div>
          </div>
          <div className="dm-ops-quick-clusters">
            <div className="dm-ops-quick-cluster">
              <div className="tf-section-kicker">Переходы</div>
              <div className="dm-ops-quick-cluster-title">Быстрые переходы</div>
              <div className="dm-ops-quick-actions-grid">
                {quickNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className="btn secondary dm-ops-quick-action dm-ops-quick-action-compact"
                      onClick={item.onClick}
                    >
                      <Icon className="icon" aria-hidden="true" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="dm-ops-quick-cluster">
              <div className="tf-section-kicker">Сцена</div>
              <div className="dm-ops-quick-cluster-title">Моментальные действия</div>
              <div className="dm-ops-session-actions">
                <button
                  type="button"
                  className="btn secondary dm-ops-quick-action dm-ops-quick-action-compact"
                  onClick={() => openQuickNote("all")}
                >
                  <Eye className="icon" aria-hidden="true" />
                  Инфоблок всем
                </button>
                <button
                  type="button"
                  className="btn secondary dm-ops-quick-action dm-ops-quick-action-compact"
                  onClick={() => openQuickNote("dm")}
                >
                  <EyeOff className="icon" aria-hidden="true" />
                  Инфоблок DM
                </button>
                <button
                  type="button"
                  className="btn secondary dm-ops-quick-action dm-ops-quick-action-compact"
                  onClick={() => {
                    setQuickTicketSummary(null);
                    setQuickTicketsOpen(true);
                  }}
                >
                  <Coins className="icon" aria-hidden="true" />
                  Билеты по группе
                </button>
              </div>
            </div>
          </div>
          <div className="dm-ops-scene-tools">
            <div className="tf-section-kicker">Scene tools</div>
            <div className="dm-ops-quick-cluster-title">Шаблоны сцены</div>
            <div className="small">Шаблоны для быстрых инфоблоков по ходу сцены.</div>
            <div className="dm-ops-scene-tools-grid">
              {sceneTemplates.map((template) => (
                <button
                  key={template.key}
                  type="button"
                  className="btn secondary dm-ops-quick-action dm-ops-quick-action-compact"
                  onClick={() => openQuickTemplate(template)}
                >
                  <ScrollText className="icon" aria-hidden="true" />
                  {template.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="dm-ops-quick-actions-block">
          <div className="tf-section-copy">
            <div className="tf-section-kicker">Live controls</div>
            <div className="dm-inv-panel-title">Сессионные переключатели</div>
          </div>
          <div className="dm-ops-live-actions">
            <div className="dm-ops-live-card">
              <div className="kv">
                <div className="dm-dashboard-player-name">Бестиарий для игроков</div>
                <div className="small">
                  {info?.settings?.bestiaryEnabled
                    ? "Игроки видят общий каталог монстров."
                    : "Каталог монстров сейчас скрыт от игроков."}
                </div>
              </div>
              <div className="dm-ops-live-card-actions">
                <span className={`badge ${info?.settings?.bestiaryEnabled ? "ok" : "off"}`}>
                  {info?.settings?.bestiaryEnabled ? "ON" : "OFF"}
                </span>
                <button
                  type="button"
                  className={`btn ${info?.settings?.bestiaryEnabled ? "secondary" : ""}`}
                  onClick={toggleBestiaryAccess}
                  disabled={bestiaryBusy}
                >
                  {bestiaryBusy
                    ? "Сохраняю..."
                    : info?.settings?.bestiaryEnabled
                      ? "Скрыть"
                      : "Открыть"}
                </button>
              </div>
            </div>
            <div className="dm-ops-live-card">
              <div className="kv">
                <div className="dm-dashboard-player-name">Последний инфоблок</div>
                <div className="small">
                  {lastSceneBlock?.title
                    ? `Сейчас: ${lastSceneBlock.title}`
                    : "Можно быстро открыть или скрыть последний блок сцены."}
                </div>
              </div>
              <div className="dm-ops-live-card-actions">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => updateLastBlockAccess("dm")}
                  disabled={quickNoteBusy}
                >
                  Только DM
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => updateLastBlockAccess("all")}
                  disabled={quickNoteBusy}
                >
                  Показать всем
                </button>
              </div>
            </div>
            <div className="dm-ops-live-card">
              <div className="kv">
                <div className="dm-dashboard-player-name">Быстрый бонус</div>
                <div className="small">Мгновенная награда для игроков, которые сейчас онлайн.</div>
              </div>
              <div className="dm-ops-live-card-actions">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => applyQuickTicketReward(1, "online", "Быстрый бонус сцены")}
                  disabled={quickTicketsBusy}
                >
                  +1 онлайн
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => applyQuickTicketReward(3, "online", "Крупный бонус сцены")}
                  disabled={quickTicketsBusy}
                >
                  +3 онлайн
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showQuickSwitch ? (
        <div className="dm-ops-switch">
          <div className="tf-section-copy">
            <div className="tf-section-kicker">Quick switch</div>
            <div className="dm-inv-panel-title">Быстрый переход по DM</div>
          </div>
          <input
            value={quickQuery}
            onChange={(event) => setQuickQuery(event.target.value)}
            placeholder="Игрок, монстр, инфоблок..."
            aria-label="Быстрый поиск по DM"
            className="u-w-full"
          />
          {quickErr ? <div className="badge off">{quickErr}</div> : null}
          {!normalizedQuery ? (
            <div className="dm-ops-switch-grid">
              {playerQuick.pinnedItems.length || playerProfileQuick.recentItems.length ? (
                <div className="dm-ops-switch-group">
                  <div className="tf-section-kicker">Игроки</div>
                  <div className="dm-quick-access-chips">
                    {playerQuick.pinnedItems.map((player) => (
                      <button
                        key={`ops-player-pin-${player.id}`}
                        type="button"
                        className="dm-quick-access-chip is-pinned"
                        onClick={() => openQuickResult({
                          onSelect: () => {
                            playerQuick.trackRecent(player.id);
                            playerProfileQuick.trackRecent(player.id);
                            navigate(`/dm/app/players/${player.id}/profile`);
                          }
                        })}
                      >
                        {player.displayName || `#${player.id}`}
                      </button>
                    ))}
                    {playerProfileQuick.recentItems.map((player) => (
                      <button
                        key={`ops-player-recent-${player.id}`}
                        type="button"
                        className="dm-quick-access-chip"
                        onClick={() => openQuickResult({
                          onSelect: () => {
                            playerQuick.trackRecent(player.id);
                            playerProfileQuick.trackRecent(player.id);
                            navigate(`/dm/app/players/${player.id}/profile`);
                          }
                        })}
                      >
                        {player.displayName || `#${player.id}`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {bestiaryQuick.pinnedItems.length || bestiaryQuick.recentItems.length ? (
                <div className="dm-ops-switch-group">
                  <div className="tf-section-kicker">Бестиарий</div>
                  <div className="dm-quick-access-chips">
                    {bestiaryQuick.pinnedItems.map((monster) => (
                      <button
                        key={`ops-monster-pin-${monster.id}`}
                        type="button"
                        className="dm-quick-access-chip is-pinned"
                        onClick={() => openQuickResult({
                          onSelect: () => {
                            bestiaryQuick.trackRecent(monster.id);
                            navigate(`/dm/app/bestiary?id=${monster.id}`);
                          }
                        })}
                      >
                        {monster.name || `#${monster.id}`}
                      </button>
                    ))}
                    {bestiaryQuick.recentItems.map((monster) => (
                      <button
                        key={`ops-monster-recent-${monster.id}`}
                        type="button"
                        className="dm-quick-access-chip"
                        onClick={() => openQuickResult({
                          onSelect: () => {
                            bestiaryQuick.trackRecent(monster.id);
                            navigate(`/dm/app/bestiary?id=${monster.id}`);
                          }
                        })}
                      >
                        {monster.name || `#${monster.id}`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {infoQuick.pinnedItems.length || infoQuick.recentItems.length ? (
                <div className="dm-ops-switch-group">
                  <div className="tf-section-kicker">Инфоблоки</div>
                  <div className="dm-quick-access-chips">
                    {infoQuick.pinnedItems.map((block) => (
                      <button
                        key={`ops-block-pin-${block.id}`}
                        type="button"
                        className="dm-quick-access-chip is-pinned"
                        onClick={() => openQuickResult({
                          onSelect: () => {
                            infoQuick.trackRecent(block.id);
                            navigate(`/dm/app/info?id=${block.id}`);
                          }
                        })}
                      >
                        {block.title || `#${block.id}`}
                      </button>
                    ))}
                    {infoQuick.recentItems.map((block) => (
                      <button
                        key={`ops-block-recent-${block.id}`}
                        type="button"
                        className="dm-quick-access-chip"
                        onClick={() => openQuickResult({
                          onSelect: () => {
                            infoQuick.trackRecent(block.id);
                            navigate(`/dm/app/info?id=${block.id}`);
                          }
                        })}
                      >
                        {block.title || `#${block.id}`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {!quickLoaded ? <div className="small note-hint">Подгружаю каталоги монстров и инфоблоков…</div> : null}
            </div>
          ) : (
            <div className="dm-ops-switch-results">
              {quickResults.length ? quickResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="dm-ops-switch-result"
                  onClick={() => openQuickResult(result)}
                >
                  <div className="tf-section-kicker">{result.type}</div>
                  <div className="dm-ops-switch-result-title">{result.title}</div>
                  <div className="small">{result.subtitle}</div>
                </button>
              )) : (
                <div className="small note-hint">Ничего не найдено по текущему запросу.</div>
              )}
            </div>
          )}
        </div>
      ) : null}

      <Modal open={quickNoteOpen} title="Быстрый инфоблок" onClose={() => !quickNoteBusy && setQuickNoteOpen(false)}>
        <div className="list">
          <div className="small">Создаёт сессионный инфоблок и сразу открывает его в редакторе.</div>
          <div className="row u-row-wrap">
            <button
              type="button"
              className={`btn ${quickNoteForm.access === "all" ? "" : "secondary"}`}
              onClick={() => setQuickNoteForm((prev) => ({ ...prev, access: "all" }))}
              disabled={quickNoteBusy}
            >
              <Eye className="icon" aria-hidden="true" />
              Всем
            </button>
            <button
              type="button"
              className={`btn ${quickNoteForm.access === "dm" ? "" : "secondary"}`}
              onClick={() => setQuickNoteForm((prev) => ({ ...prev, access: "dm" }))}
              disabled={quickNoteBusy}
            >
              <EyeOff className="icon" aria-hidden="true" />
              Только DM
            </button>
          </div>
          <input
            value={quickNoteForm.title}
            onChange={(event) => setQuickNoteForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Заголовок"
            aria-label="Заголовок быстрого инфоблока"
            className="u-w-full"
            disabled={quickNoteBusy}
          />
          <div className="small">
            {quickNoteForm.access === "all"
              ? "После создания блок сразу будет доступен всем игрокам."
              : "После создания блок останется виден только мастеру."}
          </div>
          <textarea
            value={quickNoteForm.content}
            onChange={(event) => setQuickNoteForm((prev) => ({ ...prev, content: event.target.value }))}
            placeholder="Текст блока"
            aria-label="Текст быстрого инфоблока"
            rows={8}
            className="u-w-full"
            disabled={quickNoteBusy}
          />
          <button type="button" className="btn" onClick={createQuickNote} disabled={quickNoteBusy}>
            <PlusSquare className="icon" aria-hidden="true" />
            {quickNoteBusy ? "Создаю..." : "Создать и открыть"}
          </button>
        </div>
      </Modal>

      <Modal open={quickTicketsOpen} title="Билеты по группе" onClose={() => !quickTicketsBusy && setQuickTicketsOpen(false)}>
        <div className="list">
          <div className="small">Быстрая массовая корректировка билетов для текущей сессии.</div>
          <select
            value={quickTicketScope}
            onChange={(event) => setQuickTicketScope(event.target.value)}
            aria-label="Группа игроков для билетов"
            className="u-w-full"
            disabled={quickTicketsBusy}
          >
            {ticketScopeOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}: {option.count}
              </option>
            ))}
          </select>
          <input
            value={quickTicketDelta}
            onChange={(event) => setQuickTicketDelta(event.target.value)}
            placeholder="Изменение билетов, например +1 или -2"
            aria-label="Изменение билетов группе"
            className="u-w-full"
            disabled={quickTicketsBusy}
          />
          <input
            value={quickTicketReason}
            onChange={(event) => setQuickTicketReason(event.target.value)}
            placeholder="Причина"
            aria-label="Причина изменения билетов"
            className="u-w-full"
            disabled={quickTicketsBusy}
          />
          <div className="small">Будет изменено игроков: {quickTicketTargets.length}</div>
          <button type="button" className="btn" onClick={applyQuickTickets} disabled={quickTicketsBusy}>
            {quickTicketsBusy ? "Применяю..." : "Применить"}
          </button>
          {quickTicketSummary ? (
            <div className="list">
              <div className={`badge ${quickTicketSummary.failedCount ? "warn" : "ok"}`}>
                Изменено: {quickTicketSummary.appliedCount || 0} • ошибок: {quickTicketSummary.failedCount || 0} • пропусков: {quickTicketSummary.skippedCount || 0}
              </div>
              {Array.isArray(quickTicketSummary.items) && quickTicketSummary.items.some((item) => !item.ok) ? (
                <div className="paper-note">
                  <div className="title">Проблемные игроки</div>
                  <div className="list u-mt-8">
                    {quickTicketSummary.items.filter((item) => !item.ok).map((item) => (
                      <div key={`ops-bulk-ticket-error-${item.playerId}`} className="small">
                        #{item.playerId}: {formatError(item.error || "request_failed")}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
