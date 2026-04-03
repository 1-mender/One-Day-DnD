import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { formatError } from "../lib/formatError.js";
import { makeProof } from "../lib/gameProof.js";
import { useSocket } from "../context/SocketContext.jsx";
import { useReadOnly } from "./useReadOnly.js";

export function useTickets() {
  const [state, setState] = useState(null);
  const [rules, setRules] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [usage, setUsage] = useState({ playsToday: {}, purchasesToday: {} });
  const [quests, setQuests] = useState([]);
  const [questHistory, setQuestHistory] = useState([]);
  const [matchmaking, setMatchmaking] = useState({ activeQueue: null, history: [] });
  const [arcadeMetrics, setArcadeMetrics] = useState({
    matches: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    avgQueueWaitMs: null
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const refreshInFlightRef = useRef(null);
  const refreshQueuedRef = useRef(false);
  const refreshTimerRef = useRef(null);

  const readOnly = useReadOnly();

  const applyPayload = useCallback((payload) => {
    if (!payload) return;
    if (payload.state) setState(payload.state);
    if (payload.rules) setRules(payload.rules);
    if (payload.catalog) setCatalog(Array.isArray(payload.catalog) ? payload.catalog : []);
    if (payload.usage) setUsage(payload.usage);
    if (payload.quests) setQuests(Array.isArray(payload.quests) ? payload.quests : []);
    if (payload.questHistory) setQuestHistory(Array.isArray(payload.questHistory) ? payload.questHistory : []);
    if (payload.matchmaking) {
      setMatchmaking({
        activeQueue: payload.matchmaking.activeQueue || null,
        history: Array.isArray(payload.matchmaking.history) ? payload.matchmaking.history : []
      });
    }
    if (payload.arcadeMetrics) {
      setArcadeMetrics({
        matches: Number(payload.arcadeMetrics.matches || 0),
        wins: Number(payload.arcadeMetrics.wins || 0),
        losses: Number(payload.arcadeMetrics.losses || 0),
        winRate: Number(payload.arcadeMetrics.winRate || 0),
        avgQueueWaitMs: payload.arcadeMetrics.avgQueueWaitMs == null
          ? null
          : Number(payload.arcadeMetrics.avgQueueWaitMs)
      });
    }
  }, []);

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return refreshInFlightRef.current;
    }

    const run = (async () => {
      setErr("");
      setLoading(true);
      try {
        const res = await api.ticketsMe();
        applyPayload(res);
      } catch (e) {
        setErr(formatError(e));
      } finally {
        setLoading(false);
      }
    })();

    refreshInFlightRef.current = run;
    try {
      await run;
    } finally {
      refreshInFlightRef.current = null;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        refresh().catch(() => {});
      }
    }
  }, [applyPayload]);

  const scheduleRefresh = useCallback((delayMs = 150) => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      refresh().catch(() => {});
    }, Math.max(0, Number(delayMs) || 0));
  }, [refresh]);

  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return () => {};
    refresh().catch(() => {});
    const onUpdated = () => scheduleRefresh(120);
    const onSettings = () => scheduleRefresh(120);
    const onQueueUpdated = () => scheduleRefresh(80);
    const onMatchFound = () => scheduleRefresh(80);
    const onMatchState = () => scheduleRefresh(80);
    socket.on("tickets:updated", onUpdated);
    socket.on("settings:updated", onSettings);
    socket.on("arcade:queue:updated", onQueueUpdated);
    socket.on("arcade:match:found", onMatchFound);
    socket.on("arcade:match:state", onMatchState);
    return () => {
      socket.off("tickets:updated", onUpdated);
      socket.off("settings:updated", onSettings);
      socket.off("arcade:queue:updated", onQueueUpdated);
      socket.off("arcade:match:found", onMatchFound);
      socket.off("arcade:match:state", onMatchState);
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [refresh, scheduleRefresh, socket]);

  const play = useCallback(async (payload) => {
    const nextPayload = { ...(payload || {}) };
    if ((!nextPayload.seed || !nextPayload.proof) && nextPayload.gameKey) {
      const issued = await api.ticketsSeed(nextPayload.gameKey);
      nextPayload.seed = String(issued?.seed || "");
      nextPayload.proof = String(issued?.proof || "");
    }
    nextPayload.clientProof = await makeProof(nextPayload.seed || "", nextPayload.proof || "", {
      gameKey: String(nextPayload.gameKey || ""),
      outcome: String(nextPayload.outcome || ""),
      performance: String(nextPayload.performance || "normal"),
      payload: nextPayload.payload || {}
    });
    const res = await api.ticketsPlay(nextPayload);
    applyPayload(res);
    return res;
  }, [applyPayload]);

  const purchase = useCallback(async (payload) => {
    const res = await api.ticketsPurchase(payload);
    applyPayload(res);
    return res;
  }, [applyPayload]);

  const queueMatchmaking = useCallback(async (payload) => {
    const res = await api.ticketsQueueMatchmaking(payload);
    applyPayload(res);
    return res;
  }, [applyPayload]);

  const cancelMatchmaking = useCallback(async (queueId = null) => {
    const res = await api.ticketsCancelMatchmaking(queueId);
    applyPayload(res);
    return res;
  }, [applyPayload]);

  const rematch = useCallback(async (matchId) => {
    const res = await api.ticketsRematch(matchId);
    applyPayload(res);
    return res;
  }, [applyPayload]);

  const completeMatch = useCallback(async (matchId, payload = {}) => {
    const res = await api.ticketsCompleteMatch(matchId, payload);
    await refresh();
    return res;
  }, [refresh]);

  const loadHistory = useCallback(async (limit = 20) => {
    const res = await api.ticketsMatchHistory(limit);
    return Array.isArray(res?.items) ? res.items : [];
  }, []);

  return {
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
    refresh,
    play,
    purchase,
    queueMatchmaking,
    cancelMatchmaking,
    rematch,
    completeMatch,
    loadHistory,
    readOnly
  };
}
