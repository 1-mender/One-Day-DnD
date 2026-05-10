import { useCallback, useEffect, useState } from "react";
import { api } from "../../../api.js";
import { useSocket } from "../../../context/SocketContext.jsx";
import { formatError } from "../../../lib/formatError.js";

const ENV_MAX_WEIGHT = Number(import.meta.env.VITE_INVENTORY_WEIGHT_LIMIT || 0);

export function useInventoryData() {
  const [items, setItems] = useState([]);
  const [players, setPlayers] = useState([]);
  const [maxWeight, setMaxWeight] = useState(ENV_MAX_WEIGHT);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const response = await api.invMine();
      setItems(response.items || []);
      const limit = Number(response?.weightLimit);
      if (Number.isFinite(limit)) {
        setMaxWeight((prev) => (prev === limit ? prev : limit));
      }
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlayers = useCallback(async () => {
    try {
      const [meRes, listRes] = await Promise.all([api.me(), api.players()]);
      const meId = meRes?.player?.id ?? null;
      const list = Array.isArray(listRes?.items) ? listRes.items : [];
      setPlayers(list.filter((player) => player.id !== meId));
    } catch {
      setPlayers([]);
    }
  }, []);

  useEffect(() => {
    if (!socket) return () => {};
    load().catch(() => {});
    const onUpdated = () => load().catch(() => {});
    const onProfile = () => load().catch(() => {});
    socket.on("inventory:updated", onUpdated);
    socket.on("profile:updated", onProfile);
    return () => {
      socket.off("inventory:updated", onUpdated);
      socket.off("profile:updated", onProfile);
    };
  }, [load, socket]);

  return {
    items,
    setItems,
    players,
    setPlayers,
    maxWeight,
    setMaxWeight,
    err,
    setErr,
    loading,
    setLoading,
    load,
    loadPlayers,
  };
}
