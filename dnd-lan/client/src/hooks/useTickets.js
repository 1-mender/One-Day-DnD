import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { formatError } from "../lib/formatError.js";
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
  }, [applyPayload]);

  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return () => {};
    refresh().catch(() => {});
    const onUpdated = () => refresh().catch(() => {});
    const onSettings = () => refresh().catch(() => {});
    const onQueueUpdated = () => refresh().catch(() => {});
    const onMatchFound = () => refresh().catch(() => {});
    const onMatchState = () => refresh().catch(() => {});
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
    };
  }, [refresh, socket]);

  const play = useCallback(async (payload) => {
    const nextPayload = { ...(payload || {}) };
    if ((!nextPayload.seed || !nextPayload.proof) && nextPayload.gameKey) {
      const issued = await api.ticketsSeed(nextPayload.gameKey);
      nextPayload.seed = String(issued?.seed || "");
      nextPayload.proof = String(issued?.proof || "");
    }
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
    loadHistory,
    readOnly
  };
}
