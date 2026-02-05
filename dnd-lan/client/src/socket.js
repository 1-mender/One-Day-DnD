import { io } from "socket.io-client";
import { storage } from "./api.js";

export function connectSocket({ role }) {
  const auth = {};
  if (role === "player") {
    const t = storage.getPlayerToken();
    if (t) auth.playerToken = t;
  }
  if (role === "waiting") {
    const rid = storage.getJoinRequestId();
    if (rid) auth.joinRequestId = rid;
  }
  // DM uses cookie
  const s = io("/", {
    auth,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelayMax: 5000
  });
  return s;
}
