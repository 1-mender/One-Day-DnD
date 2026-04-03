import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../../foundation/providers/index.js";
import { useLiteMode } from "../../hooks/useLiteMode.js";
import { useTickets } from "../../hooks/useTickets.js";
import { t } from "../../i18n/index.js";
import { formatError } from "../../lib/formatError.js";
import {
  formatDurationMs,
  formatEntry,
  formatTicketError,
  isGameLimitReached
} from "./domain/arcadeFormatters.js";
import {
  localizeDailyQuest,
  localizeGameCard,
  localizeModeLabel,
  localizeOutcome,
  localizePerformanceLabel
} from "./domain/arcadeLocalization.js";
import { resolveArcadeModeRules } from "./domain/arcadeModeRules.js";
import { submitArcadePlay } from "./usecases/submitArcadePlay.js";

const fallbackGames = [];

export function useArcadeController() {
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
    startGameSession,
    moveGameSession,
    finishGameSession,
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
  const activeRules = useMemo(
    () => (activeGameKey ? resolveArcadeModeRules(rules?.games?.[activeGameKey], activeModeKey) : null),
    [activeGameKey, activeModeKey, rules]
  );
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

  function getGameRulesForMode(gameKey, modeKey = "") {
    return resolveArcadeModeRules(
      rules?.games?.[gameKey],
      modeKey || selectedModes[gameKey] || ""
    );
  }

  function getDisabledReason(gameKey, modeKey = "") {
    if (readOnly) return "Режим только чтения: действия отключены";
    if (err) return "Ошибка загрузки правил";
    if (!rules || !ticketsEnabled) return "Аркада закрыта DM";
    const gameRules = getGameRulesForMode(gameKey, modeKey);
    if (gameRules?.enabled === false) return "Игра отключена DM";
    const entry = Number(gameRules?.entryCost || 0);
    if (balance < entry) return "Недостаточно билетов для входа";
    if (isGameLimitReached(gameKey, { games: { [gameKey]: gameRules } }, usage)) return "Достигнут дневной лимит попыток";
    return "";
  }

  const lastGameReason = lastGameKey ? getDisabledReason(lastGameKey) : "";
  const showLastGame = lastGameKey && rules?.games?.[lastGameKey]?.enabled !== false;

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
    const entryCost = getGameRulesForMode(gameKey)?.entryCost;
    if (entryCost == null) return formatEntry(fallback);
    return formatEntry(entryCost);
  }

  function formatRewardValue(gameKey, fallback, modeKey = "") {
    const game = getGameRulesForMode(gameKey, modeKey);
    if (!game) return fallback;
    return `${game.rewardMin}-${game.rewardMax} билетов`;
  }

  function getUiText(gameKey, field, fallback, modeKey = "") {
    const value = getGameRulesForMode(gameKey, modeKey)?.ui?.[field];
    if (typeof value === "string" && value.trim()) return value.trim();
    return fallback;
  }

  function getGameRemaining(gameKey, modeKey = "") {
    const lim = getGameRulesForMode(gameKey, modeKey)?.dailyLimit;
    if (!lim) return null;
    const used = usage?.playsToday?.[gameKey] || 0;
    const left = Math.max(0, lim - used);
    return { used, lim, left };
  }

  function setMode(gameKey, modeKey) {
    if (readOnly) return;
    setSelectedModes((prev) => ({ ...prev, [gameKey]: modeKey }));
  }

  function selectOutcome(value) {
    if (readOnly) return;
    setOutcome(value);
  }

  function selectPerformance(value) {
    if (readOnly) return;
    setPerformance(value);
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
  const handleDiceSubmit = (args) => handleGameSubmit("dice", args);
  const handleScrabbleSubmit = (args) => handleGameSubmit("scrabble", args);

  return {
    lite,
    state,
    rules,
    arcadeMetrics,
    loading,
    err,
    readOnly,
    activeGame,
    activeRules,
    activeMode,
    outcome,
    setOutcome: selectOutcome,
    performance,
    setPerformance: selectPerformance,
    busy,
    queueBusy,
    queueGame,
    setQueueGameKey,
    queueReadyGames,
    queueModes,
    queueModeKey,
    selectedModes,
    playErr,
    questUpdated,
    games,
    perfOptions,
    ticketsEnabled,
    balance,
    streak,
    dailyEarned,
    dailySpent,
    dailyCap,
    dailyQuest,
    questHistoryRows,
    lastGameKey,
    lastGameTitle,
    lastGameReason,
    showLastGame,
    queueState,
    matchHistory,
    openGame,
    closeGame,
    formatEntryValue,
    formatRewardValue,
    getUiText,
    getGameRulesForMode,
    getDisabledReason,
    getGameRemaining,
    setMode,
    formatGameModeLabel,
    handleQueueJoin,
    handleQueueCancel,
    handleRematch,
    handleMatchComplete,
    handlePlay,
    handleMatch3Submit,
    handleGuessSubmit,
    handleTttSubmit,
    handleDiceSubmit,
    handleScrabbleSubmit,
    startGameSession,
    moveGameSession,
    finishGameSession,
    formatDurationMs,
    localizeOutcome
  };
}
