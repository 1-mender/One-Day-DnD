import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import QRCodeCard from "../components/QRCodeCard.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { resolveJoinUrl } from "../lib/joinUrl.js";
import { BookOpen, Copy, Package2, QrCode, RefreshCcw, ScrollText, Search, Settings, Users } from "lucide-react";
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

      {showQr ? (
        <div className="dm-ops-qr">
          <QRCodeCard url={url} className="compact" />
        </div>
      ) : null}

      <div className="dm-ops-quick-actions">
        <div className="dm-ops-quick-actions-block">
          <div className="tf-section-copy">
            <div className="tf-section-kicker">Quick actions</div>
            <div className="dm-inv-panel-title">Быстрые переходы</div>
          </div>
          <div className="dm-ops-quick-actions-grid">
            {quickNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  className="btn secondary dm-ops-quick-action"
                  onClick={item.onClick}
                >
                  <Icon className="icon" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
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
    </div>
  );
}
