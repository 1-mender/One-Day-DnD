import { Server } from "socket.io";
import cookie from "cookie";
import { getDmCookieName, verifyDmToken } from "./auth.js";
import { getDb } from "./db.js";
import { now } from "./util.js";
import { logEvent } from "./events.js";
import { getDegradedState } from "./degraded.js";

const GRACE_MS = Number(process.env.PRESENCE_GRACE_MS || 4000);
const activeSocketsByPlayerId = new Map();
const offlineTimersByPlayerId = new Map();
let shuttingDown = false;

function getActiveCount(playerId) {
  return activeSocketsByPlayerId.get(playerId) || 0;
}

function cancelOfflineTimer(playerId) {
  const t = offlineTimersByPlayerId.get(playerId);
  if (t) {
    clearTimeout(t);
    offlineTimersByPlayerId.delete(playerId);
  }
}

function markPlayerOnline({ db, io, partyId, playerId, playerName }) {
  if (getDegradedState().degraded) return;
  const t = now();
  db.prepare("UPDATE players SET status='online', last_seen=? WHERE id=?").run(t, playerId);
  logEvent({
    partyId,
    type: "player.online",
    actorRole: "system",
    actorPlayerId: playerId,
    actorName: playerName,
    targetType: "player",
    targetId: playerId,
    message: `${playerName} online`,
    io
  });
  io.to(`party:${partyId}`).emit("player:statusChanged", { playerId, status: "online", lastSeen: t });
}

function markPlayerOffline({ db, io, partyId, playerId, playerName }) {
  if (getDegradedState().degraded) return;
  const t = now();
  db.prepare("UPDATE players SET status='offline', last_seen=? WHERE id=?").run(t, playerId);
  logEvent({
    partyId,
    type: "player.offline",
    actorRole: "system",
    actorPlayerId: playerId,
    actorName: playerName,
    targetType: "player",
    targetId: playerId,
    message: `${playerName} offline`,
    io
  });
  io.to(`party:${partyId}`).emit("player:statusChanged", { playerId, status: "offline", lastSeen: t });
}

function trackPlayerConnect({ db, io, partyId, playerId, playerName }) {
  const prev = getActiveCount(playerId);
  const next = prev + 1;
  activeSocketsByPlayerId.set(playerId, next);
  cancelOfflineTimer(playerId);
  if (prev === 0) {
    markPlayerOnline({ db, io, partyId, playerId, playerName });
  }
}

function trackPlayerDisconnect({ db, io, partyId, playerId, playerName }) {
  if (shuttingDown) return;
  const prev = getActiveCount(playerId);
  const next = Math.max(0, prev - 1);

  if (next === 0) {
    activeSocketsByPlayerId.delete(playerId);
    if (!offlineTimersByPlayerId.has(playerId)) {
      const timer = setTimeout(() => {
        offlineTimersByPlayerId.delete(playerId);
        if (getActiveCount(playerId) > 0) return;
        markPlayerOffline({ db, io, partyId, playerId, playerName });
      }, GRACE_MS);
      offlineTimersByPlayerId.set(playerId, timer);
    }
    return;
  }

  activeSocketsByPlayerId.set(playerId, next);
}

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true
    },
    pingInterval: 10000,
    pingTimeout: 30000
  });
  const originalClose = io.close.bind(io);
  io.close = (...args) => {
    shuttingDown = true;
    for (const timer of offlineTimersByPlayerId.values()) {
      clearTimeout(timer);
    }
    offlineTimersByPlayerId.clear();
    activeSocketsByPlayerId.clear();
    return originalClose(...args);
  };

  io.use((socket, next) => {
    // DM via cookie
    const rawCookie = socket.request.headers.cookie || "";
    const parsed = cookie.parse(rawCookie);
    const dmToken = parsed[getDmCookieName()];
    if (dmToken) {
      try {
        const payload = verifyDmToken(dmToken);
        socket.data.role = "dm";
        socket.data.dm = payload;
        return next();
      } catch {
        return next(new Error("dm_token_invalid"));
      }
    }

    // Player or waiting
    const auth = socket.handshake.auth || {};
    if (auth.playerToken) {
      socket.data.role = "player";
      socket.data.playerToken = String(auth.playerToken);
      return next();
    }
    if (auth.joinRequestId) {
      socket.data.role = "waiting";
      socket.data.joinRequestId = String(auth.joinRequestId);
      return next();
    }

    socket.data.role = "guest";
    return next();
  });

  io.on("connection", (socket) => {
    const db = getDb();
    const degradedState = getDegradedState();
    socket.emit("system:degraded", degradedState.degraded
      ? { ok: false, reason: degradedState.reason || "not_ready", since: degradedState.since }
      : { ok: true });

    if (socket.data.role === "dm") {
      socket.join("dm");
      socket.emit("dm:connected", { ok: true });
      return;
    }

    if (socket.data.role === "waiting") {
      const rid = socket.data.joinRequestId;
      socket.join(`joinreq:${rid}`);
      socket.emit("join:waiting", { joinRequestId: rid });
      return;
    }

    if (socket.data.role === "player") {
      const token = socket.data.playerToken;
      const sess = db.prepare("SELECT * FROM sessions WHERE token=? AND revoked=0 AND expires_at>?").get(token, now());
      if (!sess) {
        socket.emit("player:sessionInvalid");
        socket.disconnect(true);
        return;
      }

      const player = db.prepare("SELECT * FROM players WHERE id=? AND banned=0").get(sess.player_id);
      if (!player) {
        socket.emit("player:sessionInvalid");
        socket.disconnect(true);
        return;
      }

      const impersonated = !!sess.impersonated;

      socket.data.partyId = sess.party_id;
      socket.data.playerId = sess.player_id;
      socket.data.playerName = player.display_name;
      socket.data.impersonated = impersonated;

      socket.join(`party:${sess.party_id}`);
      socket.join(`player:${sess.player_id}`);

      if (!impersonated) {
        trackPlayerConnect({
          db,
          io,
          partyId: sess.party_id,
          playerId: sess.player_id,
          playerName: player.display_name
        });
      }

      socket.on("player:activity", () => {
        if (getDegradedState().degraded) return;
        if (socket.data.impersonated) return;
        const playerId = socket.data.playerId;
        const partyId = socket.data.partyId;
        if (!playerId || !partyId) return;
        const t = now();
        db.prepare("UPDATE players SET last_seen=? WHERE id=?").run(t, playerId);

        const cur = db.prepare("SELECT status FROM players WHERE id=?").get(playerId);
        if (cur?.status === "idle") {
          db.prepare("UPDATE players SET status='online' WHERE id=?").run(playerId);
          io.to(`party:${partyId}`).emit("player:statusChanged", {
            playerId,
            status: "online",
            lastSeen: t
          });
        }
      });

      socket.on("disconnect", () => {
        if (socket.data.impersonated) return;
        const playerId = socket.data.playerId;
        const partyId = socket.data.partyId;
        if (!playerId || !partyId) return;
        const playerName = socket.data.playerName || "Player";
        trackPlayerDisconnect({
          db,
          io,
          partyId,
          playerId,
          playerName
        });
      });

      socket.on("auth:swap", (nextAuth, ack) => {
        try {
          if (socket.data.role !== "player") {
            if (ack) ack({ ok: false, error: "not_player" });
            return;
          }
          const token = String(nextAuth?.playerToken || "");
          if (!token) {
            if (ack) ack({ ok: false, error: "player_token_required" });
            return;
          }

          const nextSess = db
            .prepare("SELECT * FROM sessions WHERE token=? AND revoked=0 AND expires_at>?")
            .get(token, now());
          if (!nextSess) {
            socket.emit("player:sessionInvalid");
            socket.disconnect(true);
            if (ack) ack({ ok: false, error: "session_invalid" });
            return;
          }

          const nextPlayer = db.prepare("SELECT * FROM players WHERE id=? AND banned=0").get(nextSess.player_id);
          if (!nextPlayer) {
            socket.emit("player:sessionInvalid");
            socket.disconnect(true);
            if (ack) ack({ ok: false, error: "session_invalid" });
            return;
          }

          const prevPlayerId = socket.data.playerId;
          const prevPartyId = socket.data.partyId;
          const prevName = socket.data.playerName;
          const prevImpersonated = !!socket.data.impersonated;

          const nextImpersonated = !!nextSess.impersonated;
          const nextPlayerId = nextSess.player_id;
          const nextPartyId = nextSess.party_id;
          const nextName = nextPlayer.display_name;
          const samePlayer = prevPlayerId === nextPlayerId && prevPartyId === nextPartyId;

          if (!samePlayer) {
            if (prevPartyId) socket.leave(`party:${prevPartyId}`);
            if (prevPlayerId) socket.leave(`player:${prevPlayerId}`);
            socket.join(`party:${nextPartyId}`);
            socket.join(`player:${nextPlayerId}`);
          }

          if (prevPlayerId && !prevImpersonated && (!samePlayer || nextImpersonated)) {
            trackPlayerDisconnect({
              db,
              io,
              partyId: prevPartyId,
              playerId: prevPlayerId,
              playerName: prevName || "Player"
            });
          }

          socket.data.playerToken = token;
          socket.data.partyId = nextPartyId;
          socket.data.playerId = nextPlayerId;
          socket.data.playerName = nextName;
          socket.data.impersonated = nextImpersonated;

          if (!nextImpersonated && (!samePlayer || prevImpersonated)) {
            trackPlayerConnect({
              db,
              io,
              partyId: nextPartyId,
              playerId: nextPlayerId,
              playerName: nextName
            });
          }

          if (ack) {
            ack({ ok: true, playerId: nextPlayerId, partyId: nextPartyId, impersonated: nextImpersonated });
          }
        } catch {
          if (ack) ack({ ok: false, error: "swap_failed" });
        }
      });

      return;
    }
  });

  return io;
}
