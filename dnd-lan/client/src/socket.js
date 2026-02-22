import { io } from "socket.io-client";
import { storage } from "./api.js";

export function buildSocketAuth(role) {
  if (role === "player") {
    const auth = { role: "player" };
    const token = storage.getPlayerToken();
    if (token) auth.playerToken = token;
    return auth;
  }

  if (role === "waiting") {
    const auth = { role: "waiting" };
    const rid = storage.getJoinRequestId();
    if (rid) auth.joinRequestId = rid;
    return auth;
  }

  if (role === "dm") {
    return { role: "dm" };
  }

  return {};
}

export function connectSocket({ role }) {
  const auth = buildSocketAuth(role);
  // DM uses cookie
  const s = io("/", {
    auth,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelayMax: 5000
  });
  return s;
}
