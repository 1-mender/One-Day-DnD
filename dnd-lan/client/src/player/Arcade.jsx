import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/Modal.jsx";
import { useTickets } from "../hooks/useTickets.js";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { formatError } from "../lib/formatError.js";
import { useLiteMode } from "../hooks/useLiteMode.js";

const fallbackGames = [];
const Match3Game = lazy(() => import("./games/Match3.jsx"));
const GuessCardGame = lazy(() => import("./games/GuessCard.jsx"));
const TicTacToeGame = lazy(() => import("./games/TicTacToe.jsx"));
const UnoMiniGame = lazy(() => import("./games/UnoMini.jsx"));
const ScrabbleBlitzGame = lazy(() => import("./games/ScrabbleBlitz.jsx"));

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

  const games = useMemo(() => (catalog?.length ? catalog : fallbackGames), [catalog]);
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
        label: info?.label || key,
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
  const dailyQuest = Array.isArray(quests) && quests.length ? quests[0] : null;
  const questHistoryRows = Array.isArray(questHistory) ? questHistory : [];
  const lastGameTitle = lastGameKey ? (games.find((g) => g.key === lastGameKey)?.title || lastGameKey) : "";
  const lastGameReason = lastGameKey ? getDisabledReason(lastGameKey) : "";
  const showLastGame = lastGameKey && rules?.games?.[lastGameKey]?.enabled !== false;
  const queueState = matchmaking?.activeQueue || null;
  const matchHistory = Array.isArray(matchmaking?.history) ? matchmaking.history : [];
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
    if (readOnly) return "Режим read-only: действия отключены";
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

  async function handleQueueJoin() {
    if (queueBusy || readOnly) return;
    if (!queueGame || !queueModeKey) {
      toast.warn("Select game mode first");
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
        toast.success("Match found");
      } else {
        toast.success("You are in queue");
      }
    } catch (e) {
      const code = formatError(e);
      if (String(code) === "already_in_queue") toast.warn("Queue is already active");
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
      toast.warn("Queue canceled");
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
      if (status === "matched") toast.success("Rematch started");
      else toast.success("Rematch requested");
    } catch (e) {
      const code = formatError(e);
      if (String(code) === "already_in_queue") toast.warn("Queue is already active");
      else toast.error(formatTicketError(code));
    } finally {
      setQueueBusy(false);
    }
  }

  async function handlePlay() {
    if (!activeGameKey || busy) return;
    if (!ticketsEnabled) {
      setPlayErr("Аркада закрыта DM.");
      return;
    }
    setPlayErr("");
    setBusy(true);
    try {
      const perf = outcome === "win" ? performance : "normal";
      const payload = {
        gameKey: activeGameKey,
        outcome,
        performance: perf,
        submittedAt: Date.now()
      };
      const res = await play({
        gameKey: activeGameKey,
        outcome,
        performance: perf,
        payload
      });
      const result = res?.result;
      if (result?.outcome === "win") {
        toast.success(`+${result.reward} билетов (x${result.multiplier})`, "Победа");
      } else {
        toast.warn(`-${result.penalty + result.entryCost} билетов`, "Поражение");
      }
      closeGame();
    } catch (e) {
      const msg = formatTicketError(formatError(e));
      setPlayErr(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleMatch3Submit({ outcome: finalOutcome, performance: perf, payload, seed, proof }) {
    if (!ticketsEnabled) {
      throw new Error("Аркада закрыта DM.");
    }
    try {
      const res = await play({
        gameKey: "match3",
        outcome: finalOutcome,
        performance: perf || "normal",
        payload,
        seed,
        proof
      });
      const result = res?.result;
      if (result?.outcome === "win") {
        toast.success(`+${result.reward} билетов (x${result.multiplier})`, "Победа");
      } else {
        toast.warn(`-${result.penalty + result.entryCost} билетов`, "Поражение");
      }
      return result;
    } catch (e) {
      const msg = formatTicketError(formatError(e));
      throw new Error(msg);
    }
  }

  async function handleGuessSubmit({ outcome: finalOutcome, performance: perf, payload, seed, proof }) {
    if (!ticketsEnabled) {
      throw new Error("Аркада закрыта DM.");
    }
    try {
      const res = await play({
        gameKey: "guess",
        outcome: finalOutcome,
        performance: perf || "normal",
        payload,
        seed,
        proof
      });
      const result = res?.result;
      if (result?.outcome === "win") {
        toast.success(`+${result.reward} билетов (x${result.multiplier})`, "Победа");
      } else {
        toast.warn(`-${result.penalty + result.entryCost} билетов`, "Поражение");
      }
      return result;
    } catch (e) {
      const msg = formatTicketError(formatError(e));
      throw new Error(msg);
    }
  }

  async function handleTttSubmit({ outcome: finalOutcome, performance: perf, payload, seed, proof }) {
    if (!ticketsEnabled) {
      throw new Error("Аркада закрыта DM.");
    }
    try {
      const res = await play({
        gameKey: "ttt",
        outcome: finalOutcome,
        performance: perf || "normal",
        payload,
        seed,
        proof
      });
      const result = res?.result;
      if (result?.outcome === "win") {
        toast.success(`+${result.reward} билетов (x${result.multiplier})`, "Победа");
      } else {
        toast.warn(`-${result.penalty + result.entryCost} билетов`, "Поражение");
      }
      return result;
    } catch (e) {
      const msg = formatTicketError(formatError(e));
      throw new Error(msg);
    }
  }

  async function handleUnoSubmit({ outcome: finalOutcome, performance: perf, payload, seed, proof }) {
    if (!ticketsEnabled) {
      throw new Error("Аркада закрыта DM.");
    }
    try {
      const res = await play({
        gameKey: "uno",
        outcome: finalOutcome,
        performance: perf || "normal",
        payload,
        seed,
        proof
      });
      const result = res?.result;
      if (result?.outcome === "win") {
        toast.success(`+${result.reward} билетов (x${result.multiplier})`, "Победа");
      } else {
        toast.warn(`-${result.penalty + result.entryCost} билетов`, "Поражение");
      }
      return result;
    } catch (e) {
      const msg = formatTicketError(formatError(e));
      throw new Error(msg);
    }
  }

  async function handleScrabbleSubmit({ outcome: finalOutcome, performance: perf, payload, seed, proof }) {
    if (!ticketsEnabled) {
      throw new Error("Аркада закрыта DM.");
    }
    try {
      const res = await play({
        gameKey: "scrabble",
        outcome: finalOutcome,
        performance: perf || "normal",
        payload,
        seed,
        proof
      });
      const result = res?.result;
      if (result?.outcome === "win") {
        toast.success(`+${result.reward} билетов (x${result.multiplier})`, "Победа");
      } else {
        toast.warn(`-${result.penalty + result.entryCost} билетов`, "Поражение");
      }
      return result;
    } catch (e) {
      const msg = formatTicketError(formatError(e));
      throw new Error(msg);
    }
  }

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
        <div className="title">Quick Match</div>
        <div className="small" style={{ marginTop: 6 }}>
          Queue, rematch, and short match history.
        </div>
        <div className="arcade-queue-row" style={{ marginTop: 8 }}>
          {queueState ? (
            <>
              <span className="badge warn">In queue: {queueState.gameKey}/{queueState.modeKey}</span>
              <span className="badge secondary">Wait: {formatDurationMs(queueState.waitMs)}</span>
              <button className="btn secondary" onClick={handleQueueCancel} disabled={queueBusy || readOnly}>
                {queueBusy ? "..." : "Cancel queue"}
              </button>
            </>
          ) : (
            <>
              <select
                value={queueGame?.key || ""}
                onChange={(e) => setQueueGameKey(e.target.value)}
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
                {queueBusy ? "..." : "Join queue"}
              </button>
            </>
          )}
        </div>
        <div className="small arcade-queue-meta" style={{ marginTop: 8 }}>
          Win rate: {Math.round(Number(arcadeMetrics?.winRate || 0) * 100)}%
          {" • "}
          Avg queue: {arcadeMetrics?.avgQueueWaitMs != null ? formatDurationMs(arcadeMetrics.avgQueueWaitMs) : "n/a"}
          {" • "}
          Matches: {Number(arcadeMetrics?.matches || 0)}
        </div>
        {matchHistory.length ? (
          <div className="arcade-queue-history" style={{ marginTop: 8 }}>
            {matchHistory.slice(0, 3).map((m) => (
              <div key={`hist_${m.matchId}`} className="arcade-queue-history-item">
                <span className="small">
                  {m.gameKey}/{m.modeKey} • {m.result} {m.opponentName ? `vs ${m.opponentName}` : ""}
                </span>
                <button className="btn secondary" onClick={() => handleRematch(m.matchId)} disabled={queueBusy || readOnly}>
                  Rematch
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {dailyQuest ? (
        <div className="paper-note arcade-note" style={{ marginTop: 10 }}>
          <div className="title">Daily quest</div>
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
        <div className="badge ok" style={{ marginTop: 8 }}>Daily quest: готово к награде</div>
      ) : null}
      <hr />

      <div className="arcade-grid">
        {games.map((g) => {
          const rulesToShow = lite ? g.rules.slice(0, 2) : g.rules;
          const hasMoreRules = lite && g.rules.length > rulesToShow.length;
          const remaining = getGameRemaining(g.key);
          const disabledReason = getDisabledReason(g.key);
          const canPlay = !disabledReason;
          const difficultyLabel = getUiText(g.key, "difficulty", g.difficulty);
          const riskLabel = getUiText(g.key, "risk", g.risk);
          const timeLabel = getUiText(g.key, "time", g.time);
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
        <Suspense fallback={renderGameFallback(activeGame?.title || "Match3", closeGame)}>
          <Match3Game
            open={!!activeGame}
            onClose={closeGame}
            onSubmitResult={handleMatch3Submit}
            disabled={!ticketsEnabled || rules?.games?.match3?.enabled === false}
            entryCost={Number(rules?.games?.match3?.entryCost || 0)}
            rewardRange={
              rules?.games?.match3
                ? `${rules.games.match3.rewardMin}-${rules.games.match3.rewardMax} tickets`
                : "-"
            }
            mode={activeMode}
            readOnly={readOnly}
          />
        </Suspense>
      ) : activeGame?.key === "guess" ? (
        <Suspense fallback={renderGameFallback(activeGame?.title || "Guess", closeGame)}>
          <GuessCardGame
            open={!!activeGame}
            onClose={closeGame}
            onSubmitResult={handleGuessSubmit}
            disabled={!ticketsEnabled || rules?.games?.guess?.enabled === false}
            entryCost={Number(rules?.games?.guess?.entryCost || 0)}
            rewardRange={
              rules?.games?.guess
                ? `${rules.games.guess.rewardMin}-${rules.games.guess.rewardMax} tickets`
                : "-"
            }
            mode={activeMode}
            readOnly={readOnly}
          />
        </Suspense>
      ) : activeGame?.key === "ttt" ? (
        <Suspense fallback={renderGameFallback(activeGame?.title || "TicTacToe", closeGame)}>
          <TicTacToeGame
            open={!!activeGame}
            onClose={closeGame}
            onSubmitResult={handleTttSubmit}
            disabled={!ticketsEnabled || rules?.games?.ttt?.enabled === false}
            entryCost={Number(rules?.games?.ttt?.entryCost || 0)}
            rewardRange={
              rules?.games?.ttt
                ? `${rules.games.ttt.rewardMin}-${rules.games.ttt.rewardMax} tickets`
                : "-"
            }
            mode={activeMode}
            readOnly={readOnly}
          />
        </Suspense>
      ) : activeGame?.key === "uno" ? (
        <Suspense fallback={renderGameFallback(activeGame?.title || "Uno", closeGame)}>
          <UnoMiniGame
            open={!!activeGame}
            onClose={closeGame}
            onSubmitResult={handleUnoSubmit}
            disabled={!ticketsEnabled || rules?.games?.uno?.enabled === false}
            entryCost={Number(rules?.games?.uno?.entryCost || 0)}
            rewardRange={
              rules?.games?.uno
                ? `${rules.games.uno.rewardMin}-${rules.games.uno.rewardMax} tickets`
                : "-"
            }
            mode={activeMode}
            readOnly={readOnly}
          />
        </Suspense>
      ) : activeGame?.key === "scrabble" ? (
        <Suspense fallback={renderGameFallback(activeGame?.title || "Scrabble", closeGame)}>
          <ScrabbleBlitzGame
            open={!!activeGame}
            onClose={closeGame}
            onSubmitResult={handleScrabbleSubmit}
            disabled={!ticketsEnabled || rules?.games?.scrabble?.enabled === false}
            entryCost={Number(rules?.games?.scrabble?.entryCost || 0)}
            rewardRange={
              rules?.games?.scrabble
                ? `${rules.games.scrabble.rewardMin}-${rules.games.scrabble.rewardMax} tickets`
                : "-"
            }
            mode={activeMode}
            readOnly={readOnly}
          />
        </Suspense>
      ) : (
        <Modal
          open={!!activeGame}
          title={activeGame ? `Game: ${activeGame.title}` : ""}
          onClose={closeGame}
        >
          <div className="list arcade-play-modal">
            <div className="small note-hint">
              {activeRules
                ? `Entry: ${formatEntry(activeRules.entryCost)} | Reward: ${activeRules.rewardMin}-${activeRules.rewardMax}`
                : "Rules unavailable"}
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className={`btn ${outcome === "win" ? "" : "secondary"}`} onClick={() => setOutcome("win")}>Win</button>
              <button className={`btn ${outcome === "loss" ? "" : "secondary"}`} onClick={() => setOutcome("loss")}>Loss</button>
            </div>
            {outcome === "win" ? (
              <div className="list">
                <div className="small">Performance:</div>
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
              <div className="small">Loss applies entry cost and penalty.</div>
            )}
            {playErr ? <div className="badge off">Error: {playErr}</div> : null}
            <button className="btn" disabled={busy || readOnly} onClick={handlePlay}>
              {busy ? "Submitting..." : "Submit result"}
            </button>
            {readOnly ? <div className="small">Read-only mode: actions are disabled.</div> : null}
          </div>
        </Modal>
      )}
    </div>
  );
}

function renderGameFallback(title, onClose) {
  return (
    <Modal open title={title ? `Game: ${title}` : "Game"} onClose={onClose}>
      <div className="small">Loading game...</div>
    </Modal>
  );
}

function impactClass(label) {
  const v = String(label || "").toLowerCase();
  if (v.includes("слож") || v.includes("hard") || v.includes("high") || v.includes("высок")) return "impact-high";
  if (v.includes("сред") || v.includes("mid") || v.includes("medium")) return "impact-mid";
  if (v.includes("лег") || v.includes("easy") || v.includes("низ")) return "impact-low";
  return "impact-low";
}

function formatEntry(entry) {
  const qty = Number(entry || 0);
  if (!qty) return "Вход: бесплатно";
  return `Вход: ${qty} ${qty === 1 ? "билет" : qty < 5 ? "билета" : "билетов"}`;
}

function formatDayKey(dayKey) {
  const n = Number(dayKey);
  if (!Number.isFinite(n) || n <= 0) return String(dayKey || "");
  const d = new Date(n * 24 * 60 * 60 * 1000);
  const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = months[d.getUTCMonth()] || "";
  return month ? `${day} ${month}` : day;
}

function formatDurationMs(ms) {
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function formatTicketError(code) {
  const c = String(code || "");
  if (c === "tickets_disabled") return "Аркада временно закрыта.";
  if (c === "game_disabled") return "Эта игра сейчас закрыта.";
  if (c === "not_enough_tickets") return "Недостаточно билетов для входа.";
  if (c === "daily_game_limit") return "Достигнут дневной лимит попыток.";
  if (c === "daily_spend_cap") return "Достигнут дневной лимит трат.";
  if (c === "invalid_performance") return "Неверный бонус выполнения.";
  if (c === "invalid_seed") return "Сессия игры устарела. Откройте игру снова.";
  if (c === "invalid_proof") return "Результат игры не прошел проверку.";
  if (c === "invalid_game") return "Эта игра недоступна.";
  if (c === "invalid_mode") return "Selected mode is not available.";
  if (c === "already_in_queue") return "You are already in queue.";
  if (c === "match_not_found") return "Match not found.";
  if (c === "opponent_not_found") return "Opponent not found.";
  if (c === "forbidden") return "Action is not allowed.";
  return c || "Ошибка";
}

function isGameLimitReached(gameKey, rules, usage) {
  const lim = rules?.games?.[gameKey]?.dailyLimit;
  if (!lim) return false;
  const used = usage?.playsToday?.[gameKey] || 0;
  return used >= lim;
}
