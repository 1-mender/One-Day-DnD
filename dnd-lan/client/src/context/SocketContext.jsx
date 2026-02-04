import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { connectSocket } from "../socket.js";
import { storage } from "../api.js";

const SocketCtx = createContext(null);

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

  useEffect(() => {
    roleRef.current = role;
    const s = connectSocket({ role });
    s.auth = buildAuth(role);
    socketRef.current = s;
    setSocket(s);
    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [role]);

  const refreshAuth = useCallback(() => {
    const s = socketRef.current;
    if (!s) return;
    s.auth = buildAuth(roleRef.current);
    if (s.connected) s.disconnect();
    s.connect();
  }, []);

  return (
    <SocketCtx.Provider value={{ socket, refreshAuth }}>
      {children}
    </SocketCtx.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketCtx);
  if (!ctx) return { socket: null, refreshAuth: () => {} };
  return ctx;
}
