import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { connectSocket } from "../socket.js";
import { storage } from "../api.js";

const SocketCtx = createContext(null);
const RECONNECT_SAMPLES_LIMIT = 50;

function normalizeSocketError(err) {
  if (!err) return null;
  if (typeof err === "string") return err;
  if (err.message) return String(err.message);
  if (err.data?.message) return String(err.data.message);
  if (err.data?.code) return String(err.data.code);
  return "connect_error";
}

function buildAuth(role) {
  if (role === "player") {
    const t = storage.getPlayerToken();
    return t ? { playerToken: t } : {};
  }
  if (role === "waiting") {
    const rid = storage.getJoinRequestId();
    return rid ? { joinRequestId: rid } : {};
  }
  return {};
}

export function SocketProvider({ role, children }) {
  const socketRef = useRef(null);
  const roleRef = useRef(role);
  const [socket, setSocket] = useState(null);
  const reconnectSamplesRef = useRef([]);
  const dropAtRef = useRef(null);
  const hasConnectedRef = useRef(false);
  const [netState, setNetState] = useState({
    reconnecting: false,
    lastError: null,
    lastReconnectMs: null,
    sampleCount: 0,
    degraded: false,
    degradedReason: null
  });

  useEffect(() => {
    roleRef.current = role;
    const s = connectSocket({ role });
    s.auth = buildAuth(role);
    socketRef.current = s;
    setSocket(s);
    reconnectSamplesRef.current = [];
    dropAtRef.current = null;
    hasConnectedRef.current = false;
    setNetState({
      reconnecting: false,
      lastError: null,
      lastReconnectMs: null,
      sampleCount: 0,
      degraded: false,
      degradedReason: null
    });
    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [role]);

  useEffect(() => {
    if (!socket) return () => {};
    let closed = false;

    const markReconnecting = (reason) => {
      if (closed) return;
      setNetState((prev) => ({
        ...prev,
        reconnecting: true,
        lastError: reason ?? prev.lastError
      }));
    };

    const onConnect = () => {
      if (closed) return;
      hasConnectedRef.current = true;
      if (dropAtRef.current != null) {
        const ms = Date.now() - dropAtRef.current;
        dropAtRef.current = null;
        const samples = reconnectSamplesRef.current;
        samples.push(ms);
        if (samples.length > RECONNECT_SAMPLES_LIMIT) samples.shift();
        setNetState((prev) => ({
          ...prev,
          reconnecting: false,
          lastError: null,
          lastReconnectMs: ms,
          sampleCount: samples.length
        }));
        return;
      }
      setNetState((prev) => ({ ...prev, reconnecting: false, lastError: null }));
    };

    const onDisconnect = () => {
      if (closed) return;
      if (hasConnectedRef.current && dropAtRef.current == null) {
        dropAtRef.current = Date.now();
      }
      markReconnecting(null);
    };

    const onConnectError = (err) => {
      if (closed) return;
      const reason = normalizeSocketError(err);
      if (hasConnectedRef.current && dropAtRef.current == null) {
        dropAtRef.current = Date.now();
      }
      markReconnecting(reason);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    if (socket.connected) onConnect();

    const onDegraded = (payload) => {
      const ok = payload?.ok !== false;
      setNetState((prev) => ({
        ...prev,
        degraded: !ok,
        degradedReason: ok ? null : String(payload?.reason || "not_ready")
      }));
    };
    socket.on("system:degraded", onDegraded);

    return () => {
      closed = true;
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("system:degraded", onDegraded);
    };
  }, [socket]);

  const getReconnectSamples = useCallback(() => {
    return reconnectSamplesRef.current.slice();
  }, []);

  const refreshAuth = useCallback(() => {
    const s = socketRef.current;
    if (!s) return;
    const nextAuth = buildAuth(roleRef.current);
    s.auth = nextAuth;
    if (s.connected && roleRef.current === "player") {
      s.emit("auth:swap", nextAuth);
      return;
    }
    if (s.connected) s.disconnect();
    s.connect();
  }, []);

  return (
    <SocketCtx.Provider value={{ socket, refreshAuth, netState, getReconnectSamples }}>
      {children}
    </SocketCtx.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketCtx);
  if (!ctx) {
    return {
      socket: null,
      refreshAuth: () => {},
      netState: {
        reconnecting: false,
        lastError: null,
        lastReconnectMs: null,
        sampleCount: 0,
        degraded: false,
        degradedReason: null
      },
      getReconnectSamples: () => []
    };
  }
  return ctx;
}
