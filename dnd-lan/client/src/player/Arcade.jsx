import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/Modal.jsx";
import { useTickets } from "../hooks/useTickets.js";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { formatError } from "../lib/formatError.js";
import { useLiteMode } from "../hooks/useLiteMode.js";
import { t } from "../i18n/index.js";
import {
  formatDayKey,
  formatDurationMs,
  formatEntry,
  formatTicketError,
  impactClass,
  isGameLimitReached
} from "./arcade/domain/arcadeFormatters.js";
import { submitArcadePlay } from "./arcade/usecases/submitArcadePlay.js";

const fallbackGames = [];
const Match3Game = lazy(() => import("./games/Match3.jsx"));
const GuessCardGame = lazy(() => import("./games/GuessCard.jsx"));
const TicTacToeGame = lazy(() => import("./games/TicTacToe.jsx"));
const UnoMiniGame = lazy(() => import("./games/UnoMini.jsx"));
const ScrabbleBlitzGame = lazy(() => import("./games/ScrabbleBlitz.jsx"));
const MODE_LABELS_RU = {
  normal: "Обычный",
  fast: "Быстрый",
  warmup: "Разминка",
  classic: "Классика",
  master: "Мастер",
  compact: "Компакт",
  chaos: "Хаос"
};
const PERFORMANCE_LABELS_RU = {
  normal: "Обычное",
  clean: "Чистая победа",
  sweep: "Сухая победа",
  combo4: "Комбо x4",
  combo5: "Комбо x5",
  first: "С первой попытки",
  second: "Со второй попытки",
  third: "С третьей попытки",
  long: "Длинное слово",
  rare: "Редкие буквы"
};
const GAME_COPY_RU = {
  ttt: {
    title: "Крестики-нолики: Дуэль разума",
    blurb: "Играй с ИИ и побеждай сериями.",
    rules: [
      "Матч до 2 побед в раундах",
      "Ничья не даёт очков и раунд переигрывается",
      "Победа 2-0 даёт повышенный множитель"
    ]
  },
  guess: {
    title: "Угадай карту: Логика и память",
    blurb: "Подсказки помогают, но время ограничено.",
    rules: [
      "Подсказки открываются по номеру попытки",
      "Чем раньше угадал, тем выше бонус",
      "Раунд ограничен таймером"
    ]
  },
  match3: {
    title: "Три в ряд: Цепочки комбо",
    blurb: "Длинные комбо-цепочки увеличивают награду.",
    rules: [
      "В каждом раунде ограничено число ходов",
      "Комбо x4 даёт дополнительный бонус",
      "Комбо x5 даёт максимальный множитель"
    ]
  },
  uno: {
    title: "Уно-мини: Быстрый матч",
    blurb: "Сбрось карты быстрее соперника.",
    rules: [
      "Победа, когда в руке 0 карт",
      "Лишние доборы повышают риск",
      "Победа без добора даёт бонус"
    ]
  },
  scrabble: {
    title: "Эрудит-блиц: Слово за минуту",
    blurb: "Собери слово из случайного набора букв.",
    rules: [
      "На отправку слова даётся 60 секунд",
      "Длинные слова дают бонус",
      "Редкие буквы усиливают награду"
    ]
  }
};

function isLikelyEnglish(text) {
  const value = String(text || "");
  return /[A-Za-z]/.test(value) && !/[А-Яа-яЁё]/.test(value);
}

function localizeTagValue(value, field) {
  const raw = String(value || "").trim();
  if (!raw) return raw;
  if (!isLikelyEnglish(raw)) return raw;
  const low = raw.toLowerCase();
  if (field === "difficulty") {
    if (low.includes("easy") || low.includes("low")) return "ЛЕГКО";
    if (low.includes("hard") || low.includes("high")) return "СЛОЖНО";
    if (low.includes("medium") || low.includes("mid")) return "СРЕДНЕ";
  }
  if (field === "risk") {
    if (low.includes("low")) return "Низкий";
    if (low.includes("high")) return "Высокий";
    if (low.includes("medium") || low.includes("mid")) return "Средний";
  }
  if (field === "time") {
    return raw
      .replace(/\bminutes?\b/gi, "мин")
      .replace(/\bmins?\b/gi, "мин")
      .replace(/\bmin\b/gi, "мин")
      .replace(/\s+/g, " ")
      .trim();
  }
  return raw;
}

function localizeModeLabel(modeKey, modeLabel) {
  const key = String(modeKey || "").toLowerCase();
  const label = String(modeLabel || "").trim();
  if (MODE_LABELS_RU[key]) return MODE_LABELS_RU[key];
  if (!isLikelyEnglish(label)) return label;
  const byLabel = MODE_LABELS_RU[label.toLowerCase()];
  return byLabel || label;
}

function localizePerformanceLabel(label, key) {
  const raw = String(label || "").trim();
  const lookup = PERFORMANCE_LABELS_RU[String(key || "").toLowerCase()];
  if (lookup) return lookup;
  if (!isLikelyEnglish(raw)) return raw;
  return raw;
}

function localizeOutcome(outcome) {
  const key = String(outcome || "").toLowerCase();
  if (key === "win") return "победа";
  if (key === "loss") return "поражение";
  if (key === "draw") return "ничья";
  return outcome || "—";
}

function localizeGameCard(game) {
  const fallback = game || {};
  const ru = GAME_COPY_RU[fallback.key] || {};
  const rules = Array.isArray(fallback.rules) ? fallback.rules : [];
  return {
    ...fallback,
    title: isLikelyEnglish(fallback.title) && ru.title ? ru.title : fallback.title,
    blurb: isLikelyEnglish(fallback.blurb) && ru.blurb ? ru.blurb : fallback.blurb,
    rules: rules.map((rule, idx) => {
      const replacement = Array.isArray(ru.rules) ? ru.rules[idx] : "";
      return isLikelyEnglish(rule) && replacement ? replacement : rule;
    }),
    difficulty: localizeTagValue(fallback.difficulty, "difficulty"),
    risk: localizeTagValue(fallback.risk, "risk"),
    time: localizeTagValue(fallback.time, "time"),
    modes: (Array.isArray(fallback.modes) ? fallback.modes : []).map((mode) => ({
      ...mode,
      label: localizeModeLabel(mode?.key, mode?.label)
    }))
  };
}

function localizeDailyQuest(quest) {
  if (!quest) return null;
  const next = { ...quest };
  const goal = Number(next.goal || 0) || 2;
  const title = String(next.title || "");
  const description = String(next.description || "");
  if (isLikelyEnglish(title) && String(next.key || "") === "daily_mix") {
    next.title = "Игровой микс";
  }
  if (isLikelyEnglish(description) && String(next.key || "") === "daily_mix") {
    const m = description.match(/play\s+(\d+)\s+different\s+games\s+today/i);
    const n = m ? Number(m[1]) || goal : goal;
    next.description = `Сыграй сегодня в ${n} разные игры`;
  }
  return next;
}

export default function Arcade() {
  const toast = useToast();
  const {
    state,
    rules,
    catalog,
    usage,
    quests,
    questHistory,
    matchmaking,
    arcadeMetrics,
    loading,
    err,
    play,
    queueMatchmaking,
    cancelMatchmaking,
    rematch,
    completeMatch,
    readOnly
  } = useTickets();
  const lite = useLiteMode();
  const [activeGameKey, setActiveGameKey] = useState("");
  const [activeModeKey, setActiveModeKey] = useState("");
  const [outcome, setOutcome] = useState("win");
  const [performance, setPerformance] = useState("");
  const [busy, setBusy] = useState(false);
  const [queueBusy, setQueueBusy] = useState(false);
  const [queueGameKey, setQueueGameKey] = useState("");
  const [playErr, setPlayErr] = useState("");
  const [questUpdated, setQuestUpdated] = useState(false);
  const questUpdatedTimer = useRef(null);
  const prevQuestKey = useRef(null);
  const questInit = useRef(false);
  const [selectedModes, setSelectedModes] = useState({});
  const [lastGameKey, setLastGameKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("fish_last_game") || "";
  });

  const games = useMemo(
    () => (catalog?.length ? catalog : fallbackGames).map((game) => localizeGameCard(game)),
    [catalog]
  );
  const activeGame = useMemo(() => games.find((g) => g.key === activeGameKey) || null, [activeGameKey, games]);
  const activeRules = activeGameKey ? rules?.games?.[activeGameKey] : null;
  const activeMode = useMemo(
    () => activeGame?.modes?.find((mode) => mode.key === activeModeKey) || activeGame?.modes?.[0] || null,
    [activeGame, activeModeKey]
  );

  useEffect(() => {
    if (typeof document === "undefined") return () => {};
    const cls = "arcade-modal-open";
    if (activeGame) {
      document.body.classList.add(cls);
      return () => document.body.classList.remove(cls);
    }
    document.body.classList.remove(cls);
    return () => {};
  }, [activeGame]);

  useEffect(() => {
    if (!games.length) return;
    setSelectedModes((prev) => {
      const next = { ...prev };
      for (const g of games) {
        if (!next[g.key] && Array.isArray(g.modes) && g.modes.length > 0) {
          next[g.key] = g.modes[0].key;
        }
      }
      return next;
    });
  }, [games]);

  const queueReadyGames = useMemo(
    () => games.filter((g) => rules?.games?.[g.key]?.enabled !== false),
    [games, rules]
  );
  const queueGame = useMemo(
    () => queueReadyGames.find((g) => g.key === queueGameKey) || queueReadyGames[0] || null,
    [queueGameKey, queueReadyGames]
  );
  const queueModes = Array.isArray(queueGame?.modes) ? queueGame.modes : [];
  const queueModeKey = queueGame ? (selectedModes[queueGame.key] || queueModes[0]?.key || "") : "";

  useEffect(() => {
    if (!queueReadyGames.length) {
      setQueueGameKey("");
      return;
    }
    if (queueGameKey && queueReadyGames.some((g) => g.key === queueGameKey)) return;
    if (lastGameKey && queueReadyGames.some((g) => g.key === lastGameKey)) {
      setQueueGameKey(lastGameKey);
      return;
    }
    setQueueGameKey(queueReadyGames[0].key);
  }, [queueReadyGames, queueGameKey, lastGameKey]);

  const perfOptions = useMemo(() => {
    const list = [];
    const perf = activeRules?.performance || {};
    for (const [key, info] of Object.entries(perf)) {
      list.push({
        key,
        label: localizePerformanceLabel(info?.label || key, key),
        multiplier: Number(info?.multiplier || 1)
      });
    }
    return list;
  }, [activeRules]);

  const ticketsEnabled = rules?.enabled !== false;
  const balance = Number(state?.balance || 0);
  const streak = Number(state?.streak || 0);
  const dailyEarned = Number(state?.dailyEarned || 0);
  const dailySpent = Number(state?.dailySpent || 0);
  const dailyCap = Number(rules?.dailyEarnCap || 0);
  const dailyQuest = useMemo(
    () => localizeDailyQuest(Array.isArray(quests) && quests.length ? quests[0] : null),
    [quests]
  );
  const questHistoryRows = Array.isArray(questHistory) ? questHistory : [];
  const lastGameTitle = lastGameKey ? (games.find((g) => g.key === lastGameKey)?.title || lastGameKey) : "";
  const lastGameReason = lastGameKey ? getDisabledReason(lastGameKey) : "";
  const showLastGame = lastGameKey && rules?.games?.[lastGameKey]?.enabled !== false;
  const queueState = matchmaking?.activeQueue || null;
  const matchHistory = Array.isArray(matchmaking?.history) ? matchmaking.history : [];

  useEffect(() => {
    if (!dailyQuest?.key) {
      prevQuestKey.current = null;
      return;
    }
    if (!questInit.current) {
      questInit.current = true;
      prevQuestKey.current = dailyQuest.key;
      return;
    }
    if (prevQuestKey.current !== dailyQuest.key) {
      prevQuestKey.current = dailyQuest.key;
      setQuestUpdated(true);
      if (questUpdatedTimer.current) clearTimeout(questUpdatedTimer.current);
      questUpdatedTimer.current = setTimeout(() => setQuestUpdated(false), 3000);
    }
  }, [dailyQuest?.key]);

  useEffect(() => () => {
    if (questUpdatedTimer.current) clearTimeout(questUpdatedTimer.current);
  }, []);

  function openGame(gameKey) {
    setActiveGameKey(gameKey);
    setActiveModeKey(selectedModes[gameKey] || "");
    setOutcome("win");
    const firstPerf = Object.keys(rules?.games?.[gameKey]?.performance || {})[0] || "normal";
    setPerformance(firstPerf);
    setPlayErr("");
    if (typeof window !== "undefined") {
      localStorage.setItem("fish_last_game", gameKey);
      setLastGameKey(gameKey);
    }
  }

  function closeGame() {
    if (busy) return;
    setActiveGameKey("");
    setActiveModeKey("");
    setPlayErr("");
  }

  function formatEntryValue(gameKey, fallback) {
    const entryCost = rules?.games?.[gameKey]?.entryCost;
    if (entryCost == null) return formatEntry(fallback);
    return formatEntry(entryCost);
  }

  function formatRewardValue(gameKey, fallback) {
    const g = rules?.games?.[gameKey];
    if (!g) return fallback;
    return `${g.rewardMin}-${g.rewardMax} билетов`;
  }

  function getUiText(gameKey, field, fallback) {
    const v = rules?.games?.[gameKey]?.ui?.[field];
    if (typeof v === "string" && v.trim()) return v.trim();
    return fallback;
  }

  function getDisabledReason(gameKey) {
    if (readOnly) return "Режим только чтения: действия отключены";
    if (err) return "Ошибка загрузки правил";
    if (!rules || !ticketsEnabled) return "Аркада закрыта DM";
    if (rules?.games?.[gameKey]?.enabled === false) return "Игра отключена DM";
    const entry = Number(rules?.games?.[gameKey]?.entryCost || 0);
    if (balance < entry) return "Недостаточно билетов для входа";
    if (isGameLimitReached(gameKey, rules, usage)) return "Достигнут дневной лимит попыток";
    return "";
  }

  function getGameRemaining(gameKey) {
    const lim = rules?.games?.[gameKey]?.dailyLimit;
    if (!lim) return null;
    const used = usage?.playsToday?.[gameKey] || 0;
    const left = Math.max(0, lim - used);
    return { used, lim, left };
  }

  function setMode(gameKey, modeKey) {
    setSelectedModes((prev) => ({ ...prev, [gameKey]: modeKey }));
  }

  function formatGameModeLabel(gameKey, modeKey) {
    const game = games.find((it) => it.key === gameKey) || null;
    const mode = game?.modes?.find((it) => it.key === modeKey) || null;
    const modeLabel = mode?.label || localizeModeLabel(modeKey, modeKey);
    return `${game?.title || gameKey}${modeLabel ? ` / ${modeLabel}` : ""}`;
  }

  async function handleQueueJoin() {
    if (queueBusy || readOnly) return;
    if (!queueGame || !queueModeKey) {
      toast.warn(t("arcade.selectMode", null, "Сначала выберите режим игры"));
      return;
    }
    setQueueBusy(true);
    try {
      const res = await queueMatchmaking({
        gameKey: queueGame.key,
        modeKey: queueModeKey
      });
      const action = res?.matchmakingAction?.status;
      if (action === "matched") {
        toast.success(t("arcade.matchFound", null, "Матч найден"));
      } else {
        toast.success(t("arcade.inQueue", null, "Вы в очереди"));
      }
    } catch (e) {
      const code = formatError(e);
      if (String(code) === "already_in_queue") toast.warn(t("arcade.queueAlready", null, "Очередь уже активна"));
      else toast.error(formatTicketError(code));
    } finally {
      setQueueBusy(false);
    }
  }

  async function handleQueueCancel() {
    if (queueBusy || readOnly) return;
    setQueueBusy(true);
    try {
      await cancelMatchmaking(queueState?.id || null);
      toast.warn(t("arcade.queueCanceled", null, "Очередь отменена"));
    } catch (e) {
      toast.error(formatTicketError(formatError(e)));
    } finally {
      setQueueBusy(false);
    }
  }

  async function handleRematch(matchId) {
    if (!matchId || queueBusy || readOnly) return;
    setQueueBusy(true);
    try {
      const res = await rematch(matchId);
      const status = res?.matchmakingAction?.status;
      if (status === "matched") toast.success(t("arcade.rematchStarted", null, "Реванш начат"));
      else toast.success(t("arcade.rematchRequested", null, "Запрос на реванш отправлен"));
    } catch (e) {
      const code = formatError(e);
      if (String(code) === "already_in_queue") toast.warn(t("arcade.queueAlready", null, "Очередь уже активна"));
      else toast.error(formatTicketError(code));
    } finally {
      setQueueBusy(false);
    }
  }

  async function handleMatchComplete(matchId, finalOutcome) {
    if (!matchId || !finalOutcome || queueBusy || readOnly) return;
    setQueueBusy(true);
    try {
      const res = await completeMatch(matchId, { outcome: finalOutcome });
      if (res?.awaitingOpponent) {
        toast.warn(t("arcade.awaitingOpponent", null, "Результат отправлен, ждём соперника"));
        return;
      }
      const finalResult = String(res?.match?.result || finalOutcome);
      if (finalResult === "win") toast.success(t("arcade.matchWin", null, "Матч завершён: победа"));
      else if (finalResult === "loss") toast.warn(t("arcade.matchLoss", null, "Матч завершён: поражение"));
      else toast.warn(t("arcade.matchDraw", null, "Матч завершён: ничья"));
    } catch (e) {
      toast.error(formatTicketError(formatError(e)));
    } finally {
      setQueueBusy(false);
    }
  }

  async function handlePlay() {
    if (!activeGameKey || busy) return;
    setPlayErr("");
    setBusy(true);
    try {
      const perf = outcome === "win" ? performance : "normal";
      await submitArcadePlay({
        play,
        toast,
        gameKey: activeGameKey,
        outcome,
        performance: perf || "normal",
        payload: {
          gameKey: activeGameKey,
          outcome,
          performance: perf,
          submittedAt: Date.now()
        },
        ticketsEnabled
      });
      closeGame();
    } catch (e) {
      const msg = String(e?.message || e || "Ошибка");
      setPlayErr(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleGameSubmit(gameKey, { outcome: finalOutcome, performance: perf, payload, seed, proof }) {
    return submitArcadePlay({
      play,
      toast,
      gameKey,
      outcome: finalOutcome,
      performance: perf || "normal",
      payload,
      seed,
      proof,
      ticketsEnabled
    });
  }

  const handleMatch3Submit = (args) => handleGameSubmit("match3", args);
  const handleGuessSubmit = (args) => handleGameSubmit("guess", args);
  const handleTttSubmit = (args) => handleGameSubmit("ttt", args);
  const handleUnoSubmit = (args) => handleGameSubmit("uno", args);
  const handleScrabbleSubmit = (args) => handleGameSubmit("scrabble", args);

  return (
    <div className={`card taped arcade-shell${lite ? " page-lite arcade-lite" : ""}`.trim()}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="arcade-title">Fish • Зал мини-игр</div>
          <div className="small">Fish — аркада мини‑игр с билетами и наградами.</div>
          <div className="small">Сыграй, собери серию и обменяй билеты у DJO.</div>
        </div>
        <div className="ticket-bank">
          <div className="ticket-card">
            <div className="ticket-label">Билеты</div>
            <div className="ticket-value">{loading ? "…" : balance}</div>
          </div>
          <div className="ticket-meta small">
            Серия побед: {loading ? "…" : streak} • Сегодня: +{dailyEarned}{dailyCap ? `/${dailyCap}` : ""} • Потрачено: {dailySpent}
          </div>
        </div>
      </div>
      <div className="arcade-banner">
        <div className="banner-title">Азарт важнее скорости</div>
        <div className="small">
          Сложнее игра — выше награда. За серии побед дают бонус, но вход требует
          билеты.
        </div>
      </div>
      <div className="paper-note arcade-queue-note" style={{ marginTop: 10 }}>
        <div className="title">{t("arcade.quickMatchTitle", null, "Быстрый матч")}</div>
        <div className="small" style={{ marginTop: 6 }}>
          {t("arcade.quickMatchHint", null, "Очередь, реванш и короткая история матчей.")}
        </div>
        <div className="arcade-queue-row" style={{ marginTop: 8 }}>
          {queueState ? (
            <>
              <span className="badge warn">{t("arcade.inQueueLabel", null, "В очереди")}: {formatGameModeLabel(queueState.gameKey, queueState.modeKey)}</span>
              <span className="badge secondary">{t("arcade.waitLabel", null, "Ожидание")}: {formatDurationMs(queueState.waitMs)}</span>
              <button className="btn secondary" onClick={handleQueueCancel} disabled={queueBusy || readOnly}>
                {queueBusy ? "..." : t("arcade.cancelQueue", null, "Отменить очередь")}
              </button>
            </>
          ) : (
            <>
              <select
                value={queueGame?.key || ""}
                onChange={(e) => setQueueGameKey(e.target.value)}
                aria-label="Игра для очереди матчмейкинга"
                disabled={queueBusy || readOnly || !queueReadyGames.length}
              >
                {queueReadyGames.map((g) => (
                  <option key={`qm_${g.key}`} value={g.key}>{g.title}</option>
                ))}
              </select>
              <div className="arcade-modes">
                {queueModes.map((mode) => (
                  <button
                    key={`qm_mode_${mode.key}`}
                    type="button"
                    className={`mode-chip${queueModeKey === mode.key ? " active" : ""}`}
                    onClick={() => queueGame && setMode(queueGame.key, mode.key)}
                    disabled={queueBusy || readOnly}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <button
                className="btn secondary"
                onClick={handleQueueJoin}
                disabled={queueBusy || readOnly || !queueGame || !queueModeKey}
              >
                {queueBusy ? "..." : t("arcade.joinQueue", null, "Встать в очередь")}
              </button>
            </>
          )}
        </div>
        <div className="small arcade-queue-meta" style={{ marginTop: 8 }}>
          {t("arcade.winRate", null, "Винрейт")}: {Math.round(Number(arcadeMetrics?.winRate || 0) * 100)}%
          {" • "}
          {t("arcade.avgQueue", null, "Средняя очередь")}: {arcadeMetrics?.avgQueueWaitMs != null ? formatDurationMs(arcadeMetrics.avgQueueWaitMs) : "—"}
          {" • "}
          {t("arcade.matches", null, "Матчи")}: {Number(arcadeMetrics?.matches || 0)}
        </div>
        {matchHistory.length ? (
          <div className="arcade-queue-history" style={{ marginTop: 8 }}>
            {matchHistory.slice(0, 3).map((m) => (
              <div key={`hist_${m.matchId}`} className="arcade-queue-history-item">
                <span className="small">
                  {formatGameModeLabel(m.gameKey, m.modeKey)} • {m.status === "completed" ? localizeOutcome(m.result) : t("arcade.active", null, "идёт")} {m.opponentName ? `${t("arcade.vs", null, "против")} ${m.opponentName}` : ""}
                </span>
                {m.status === "completed" ? (
                  <button className="btn secondary" onClick={() => handleRematch(m.matchId)} disabled={queueBusy || readOnly}>
                    {t("arcade.rematch", null, "Реванш")}
                  </button>
                ) : (
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn secondary" onClick={() => handleMatchComplete(m.matchId, "win")} disabled={queueBusy || readOnly}>
                      {t("arcade.outcomeWin", null, "Победа")}
                    </button>
                    <button className="btn secondary" onClick={() => handleMatchComplete(m.matchId, "loss")} disabled={queueBusy || readOnly}>
                      {t("arcade.outcomeLoss", null, "Поражение")}
                    </button>
                    <button className="btn secondary" onClick={() => handleMatchComplete(m.matchId, "draw")} disabled={queueBusy || readOnly}>
                      {t("arcade.outcomeDraw", null, "Ничья")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {dailyQuest ? (
        <div className="paper-note arcade-note" style={{ marginTop: 10 }}>
          <div className="title">{t("arcade.dailyQuest", null, "Ежедневный квест")}</div>
          <div className="small" style={{ marginTop: 6 }}>
            {dailyQuest.title}: {dailyQuest.description}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <span className="badge">
              Прогресс: {dailyQuest.progress}/{dailyQuest.goal}
            </span>
            <span className="badge secondary">
              Награда: {dailyQuest.reward} билета
            </span>
            {questUpdated ? (
              <span className="badge ok">Обновлено</span>
            ) : null}
            {dailyQuest.completed ? (
              <span className={`badge ${dailyQuest.rewarded ? "ok" : "warn"}`}>
                {dailyQuest.rewarded ? "Выполнено" : "Готово к награде"}
              </span>
            ) : null}
          </div>
          {dailyQuest.rewarded && dailyQuest.rewardGranted != null ? (
            <div className="small" style={{ marginTop: 6 }}>
              Получено: {dailyQuest.rewardGranted}
            </div>
          ) : null}
          {questHistoryRows.length ? (
            <div className="small" style={{ marginTop: 8 }}>
              История: {questHistoryRows.map((r) => `${formatDayKey(r.dayKey)}${r.rewardGranted ? `(+${r.rewardGranted})` : ""}`).join(", ")}
            </div>
          ) : null}
        </div>
      ) : null}
      {!ticketsEnabled ? (
        <div className="badge off" style={{ marginTop: 8 }}>Аркада закрыта DM</div>
      ) : null}
      {err ? <div className="badge off" style={{ marginTop: 8 }}>Ошибка билетов: {err}</div> : null}
      {dailyQuest && dailyQuest.completed && !dailyQuest.rewarded ? (
        <div className="badge ok" style={{ marginTop: 8 }}>{t("arcade.dailyQuestReady", null, "Ежедневный квест: награда готова")}</div>
      ) : null}
      <hr />

      <div className="arcade-grid">
        {games.map((g) => {
          const rulesToShow = lite ? g.rules.slice(0, 2) : g.rules;
          const hasMoreRules = lite && g.rules.length > rulesToShow.length;
          const remaining = getGameRemaining(g.key);
          const disabledReason = getDisabledReason(g.key);
          const canPlay = !disabledReason;
          const difficultyLabel = localizeTagValue(getUiText(g.key, "difficulty", g.difficulty), "difficulty");
          const riskLabel = localizeTagValue(getUiText(g.key, "risk", g.risk), "risk");
          const timeLabel = localizeTagValue(getUiText(g.key, "time", g.time), "time");
          const modes = Array.isArray(g.modes) ? g.modes : [];
          const selectedModeKey = selectedModes[g.key] || modes[0]?.key || "";
          return rules?.games?.[g.key]?.enabled === false ? (
            <div key={g.key} className="item taped arcade-card disabled-card">
              <div className="arcade-head">
                <div className="arcade-card-title">{g.title}</div>
                <span className="badge off">Недоступно</span>
              </div>
              <div className="small arcade-blurb">{g.blurb}</div>
              <div className="rule-list">
                {rulesToShow.map((rule, idx) => (
                  <div key={`${g.key}_${idx}`} className="rule-line">{rule}</div>
                ))}
                {hasMoreRules ? (
                  <div className="rule-more small">+ ещё {g.rules.length - rulesToShow.length}</div>
                ) : null}
              </div>
              <div className="row arcade-actions" style={{ justifyContent: "space-between" }}>
                <span className="ticket-pill">{formatRewardValue(g.key, "—")}</span>
                <button className="btn secondary" disabled>Недоступно</button>
              </div>
            </div>
          ) : (
            <div key={g.key} className="item taped arcade-card">
              <div className="arcade-head">
                <div className="arcade-card-title">{g.title}</div>
                <span
                  className={`badge badge-impact ${impactClass(difficultyLabel)}`}
                  title={`Сложность: ${difficultyLabel}`}
                >
                  {difficultyLabel}
                </span>
              </div>
              <div className="small arcade-blurb">{g.blurb}</div>
              <div className="arcade-meta">
                <span className="meta-chip" title={`Время: ${timeLabel}`}>Время: {timeLabel}</span>
                <span className="meta-chip" title={`Риск: ${riskLabel}`}>Риск: {riskLabel}</span>
                <span className="meta-chip">{formatEntryValue(g.key, 0)}</span>
                {remaining ? (
                  <span className="meta-chip">Попытки: {remaining.used}/{remaining.lim}</span>
                ) : null}
                {remaining ? (
                  <span className="meta-chip">Осталось: {remaining.left}</span>
                ) : null}
              </div>
              {modes.length > 1 ? (
                <div className="arcade-modes">
                  {modes.map((mode) => (
                    <button
                      key={`${g.key}_${mode.key}`}
                      type="button"
                      className={`mode-chip${selectedModeKey === mode.key ? " active" : ""}`}
                      onClick={() => setMode(g.key, mode.key)}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="rule-list">
                {rulesToShow.map((rule, idx) => (
                  <div key={`${g.key}_${idx}`} className="rule-line">{rule}</div>
                ))}
                {hasMoreRules ? (
                  <div className="rule-more small">+ ещё {g.rules.length - rulesToShow.length}</div>
                ) : null}
              </div>
              <div className="row arcade-actions" style={{ justifyContent: "space-between" }}>
                <span className="ticket-pill">{formatRewardValue(g.key, "—")}</span>
                <button
                  className="btn secondary"
                  disabled={!canPlay}
                  onClick={() => openGame(g.key)}
                >
                  Играть
                </button>
              </div>
              {!canPlay && disabledReason ? (
                <div className="small" style={{ marginTop: 6 }}>{disabledReason}</div>
              ) : null}
            </div>
          );
        })}
      </div>

      {showLastGame ? (
        <div className="row" style={{ marginTop: 10 }}>
          <button
            className="btn secondary"
            onClick={() => openGame(lastGameKey)}
            disabled={!!lastGameReason}
            title={lastGameReason || ""}
          >
            Последняя игра: {lastGameTitle}
          </button>
        </div>
      ) : null}


      <div className="paper-note arcade-note" style={{ marginTop: 12 }}>
        <div className="title">Правила билетов</div>
        <div className="small" style={{ marginTop: 6 }}>
          Билеты не копятся бесконечно: мастер может ограничить дневной лимит и
          выдавать бонусы за серию побед. Вход в сложные режимы стоит билеты, поэтому
          риск всегда осознанный.
        </div>
      </div>

      {activeGame?.key === "match3" ? (
        <Suspense fallback={renderGameFallback(activeGame?.title || "Три в ряд", closeGame)}>
          <Match3Game
            open={!!activeGame}
            onClose={closeGame}
            onSubmitResult={handleMatch3Submit}
            disabled={!ticketsEnabled || rules?.games?.match3?.enabled === false}
            entryCost={Number(rules?.games?.match3?.entryCost || 0)}
            rewardRange={
              rules?.games?.match3
                ? `${rules.games.match3.rewardMin}-${rules.games.match3.rewardMax} билетов`
                : "-"
            }
            mode={activeMode}
            readOnly={readOnly}
          />
        </Suspense>
      ) : activeGame?.key === "guess" ? (
        <Suspense fallback={renderGameFallback(activeGame?.title || "Угадай карту", closeGame)}>
          <GuessCardGame
            open={!!activeGame}
            onClose={closeGame}
            onSubmitResult={handleGuessSubmit}
            disabled={!ticketsEnabled || rules?.games?.guess?.enabled === false}
            entryCost={Number(rules?.games?.guess?.entryCost || 0)}
            rewardRange={
              rules?.games?.guess
                ? `${rules.games.guess.rewardMin}-${rules.games.guess.rewardMax} билетов`
                : "-"
            }
            mode={activeMode}
            readOnly={readOnly}
          />
        </Suspense>
      ) : activeGame?.key === "ttt" ? (
        <Suspense fallback={renderGameFallback(activeGame?.title || "Крестики-нолики", closeGame)}>
          <TicTacToeGame
            open={!!activeGame}
            onClose={closeGame}
            onSubmitResult={handleTttSubmit}
            disabled={!ticketsEnabled || rules?.games?.ttt?.enabled === false}
            entryCost={Number(rules?.games?.ttt?.entryCost || 0)}
            rewardRange={
              rules?.games?.ttt
                ? `${rules.games.ttt.rewardMin}-${rules.games.ttt.rewardMax} билетов`
                : "-"
            }
            mode={activeMode}
            readOnly={readOnly}
          />
        </Suspense>
      ) : activeGame?.key === "uno" ? (
        <Suspense fallback={renderGameFallback(activeGame?.title || "Уно-мини", closeGame)}>
          <UnoMiniGame
            open={!!activeGame}
            onClose={closeGame}
            onSubmitResult={handleUnoSubmit}
            disabled={!ticketsEnabled || rules?.games?.uno?.enabled === false}
            entryCost={Number(rules?.games?.uno?.entryCost || 0)}
            rewardRange={
              rules?.games?.uno
                ? `${rules.games.uno.rewardMin}-${rules.games.uno.rewardMax} билетов`
                : "-"
            }
            mode={activeMode}
            readOnly={readOnly}
          />
        </Suspense>
      ) : activeGame?.key === "scrabble" ? (
        <Suspense fallback={renderGameFallback(activeGame?.title || "Эрудит-блиц", closeGame)}>
          <ScrabbleBlitzGame
            open={!!activeGame}
            onClose={closeGame}
            onSubmitResult={handleScrabbleSubmit}
            disabled={!ticketsEnabled || rules?.games?.scrabble?.enabled === false}
            entryCost={Number(rules?.games?.scrabble?.entryCost || 0)}
            rewardRange={
              rules?.games?.scrabble
                ? `${rules.games.scrabble.rewardMin}-${rules.games.scrabble.rewardMax} билетов`
                : "-"
            }
            mode={activeMode}
            readOnly={readOnly}
          />
        </Suspense>
      ) : (
        <Modal
          open={!!activeGame}
          title={activeGame ? t("arcade.gameTitle", null, `Игра: ${activeGame.title}`) : ""}
          onClose={closeGame}
        >
          <div className="list arcade-play-modal">
            <div className="small note-hint">
              {activeRules
                ? t("arcade.entryReward", null, `${formatEntry(activeRules.entryCost)} | Награда: ${activeRules.rewardMin}-${activeRules.rewardMax}`)
                : t("arcade.rulesUnavailable", null, "Правила недоступны")}
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className={`btn ${outcome === "win" ? "" : "secondary"}`} onClick={() => setOutcome("win")}>{t("arcade.outcomeWin", null, "Победа")}</button>
              <button className={`btn ${outcome === "loss" ? "" : "secondary"}`} onClick={() => setOutcome("loss")}>{t("arcade.outcomeLoss", null, "Поражение")}</button>
            </div>
            {outcome === "win" ? (
              <div className="list">
                <div className="small">{t("arcade.performance", null, "Качество выполнения:")}</div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {perfOptions.map((opt) => (
                    <button
                      key={opt.key}
                      className={`btn ${performance === opt.key ? "" : "secondary"}`}
                      onClick={() => setPerformance(opt.key)}
                    >
                      {opt.label} x{opt.multiplier}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="small">{t("arcade.lossPenaltyHint", null, "При поражении списывается вход и штраф.")}</div>
            )}
            {playErr ? <div className="badge off">Ошибка: {playErr}</div> : null}
            <button className="btn" disabled={busy || readOnly} onClick={handlePlay}>
              {busy ? t("arcade.submitting", null, "Отправка...") : t("arcade.submitResult", null, "Отправить результат")}
            </button>
            {readOnly ? <div className="small">Режим только чтения: действия отключены.</div> : null}
          </div>
        </Modal>
      )}
    </div>
  );
}

function renderGameFallback(title, onClose) {
  return (
    <Modal open title={title ? t("arcade.gameTitle", null, `Игра: ${title}`) : t("arcade.game", null, "Игра")} onClose={onClose}>
      <div className="small">{t("arcade.loadingGame", null, "Загрузка игры...")}</div>
    </Modal>
  );
}
