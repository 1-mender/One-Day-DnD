import { useCallback, useEffect, useMemo, useState } from "react";
import { api, storage } from "../api.js";
import { formatError } from "../lib/formatError.js";
import { connectSocket } from "../socket.js";

export function useTickets() {
  const [state, setState] = useState(null);
  const [rules, setRules] = useState(null);
  const [usage, setUsage] = useState({ playsToday: {}, purchasesToday: {} });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const readOnly = storage.isImpersonating() && storage.getImpMode() === "ro";

  const applyPayload = useCallback((payload) => {
    if (!payload) return;
    if (payload.state) setState(payload.state);
    if (payload.rules) setRules(payload.rules);
    if (payload.usage) setUsage(payload.usage);
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

  const socket = useMemo(() => connectSocket({ role: "player" }), []);

  useEffect(() => {
    refresh().catch(() => {});
    socket.on("tickets:updated", () => refresh().catch(() => {}));
    socket.on("settings:updated", () => refresh().catch(() => {}));
    return () => socket.disconnect();
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
    loading,
    err,
    refresh,
    play,
    purchase,
    readOnly
  };
}
