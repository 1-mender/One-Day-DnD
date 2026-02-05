import { useCallback, useEffect, useState } from "react";
import { api, storage } from "../api.js";
import { formatError } from "../lib/formatError.js";
import { useSocket } from "../context/SocketContext.jsx";

export function useTickets() {
  const [state, setState] = useState(null);
  const [rules, setRules] = useState(null);
  const [usage, setUsage] = useState({ playsToday: {}, purchasesToday: {} });
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const readOnly = storage.isImpersonating() && storage.getImpMode() === "ro";

  const applyPayload = useCallback((payload) => {
    if (!payload) return;
    if (payload.state) setState(payload.state);
    if (payload.rules) setRules(payload.rules);
    if (payload.usage) setUsage(payload.usage);
    if (payload.quests) setQuests(Array.isArray(payload.quests) ? payload.quests : []);
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
    socket.on("tickets:updated", onUpdated);
    socket.on("settings:updated", onSettings);
    return () => {
      socket.off("tickets:updated", onUpdated);
      socket.off("settings:updated", onSettings);
    };
  }, [refresh, socket]);

  const play = useCallback(async (payload) => {
    const res = await api.ticketsPlay(payload);
    applyPayload(res);
    return res;
  }, [applyPayload]);

  const purchase = useCallback(async (payload) => {
    const res = await api.ticketsPurchase(payload);
    applyPayload(res);
    return res;
  }, [applyPayload]);

  return {
    state,
    rules,
    usage,
    quests,
    loading,
    err,
    refresh,
    play,
    purchase,
    readOnly
  };
}
