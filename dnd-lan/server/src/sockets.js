import { Server } from "socket.io";
import cookie from "cookie";
import { getDmCookieName, verifyDmToken } from "./auth.js";
import { getDb } from "./db.js";
import { now } from "./util.js";
import { logEvent } from "./events.js";

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true
    },
    pingInterval: 10000,
    pingTimeout: 30000
  });

  io.use((socket, next) => {
    try {
      // DM via cookie
      const rawCookie = socket.request.headers.cookie || "";
      const parsed = cookie.parse(rawCookie);
      const dmToken = parsed[getDmCookieName()];
      if (dmToken) {
        const payload = verifyDmToken(dmToken);
        socket.data.role = "dm";
        socket.data.dm = payload;
        return next();
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
    } catch (e) {
      return next();
    }
  });

  io.on("connection", (socket) => {
    const db = getDb();

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
      socket.data.impersonated = impersonated;

      socket.join(`party:${sess.party_id}`);
      socket.join(`player:${sess.player_id}`);

      if (!impersonated) {
        db.prepare("UPDATE players SET status='online', last_seen=? WHERE id=?").run(now(), sess.player_id);
        logEvent({
          partyId: sess.party_id,
          type: "player.online",
          actorRole: "system",
          actorPlayerId: sess.player_id,
          actorName: player.display_name,
          targetType: "player",
          targetId: sess.player_id,
          message: `${player.display_name} онлайн`,
          io
        });
        io.to(`party:${sess.party_id}`).emit("player:statusChanged", { playerId: sess.player_id, status: "online", lastSeen: now() });

        socket.on("player:activity", () => {
          const t = now();
          db.prepare("UPDATE players SET last_seen=? WHERE id=?").run(t, sess.player_id);

          const cur = db.prepare("SELECT status FROM players WHERE id=?").get(sess.player_id);
          if (cur?.status === "idle") {
            db.prepare("UPDATE players SET status='online' WHERE id=?").run(sess.player_id);
            io.to(`party:${sess.party_id}`).emit("player:statusChanged", {
              playerId: sess.player_id,
              status: "online",
              lastSeen: t
            });
          }
        });

        socket.on("disconnect", () => {
          db.prepare("UPDATE players SET status='offline', last_seen=? WHERE id=?").run(now(), sess.player_id);
          logEvent({
            partyId: sess.party_id,
            type: "player.offline",
            actorRole: "system",
            actorPlayerId: sess.player_id,
            actorName: player.display_name,
            targetType: "player",
            targetId: sess.player_id,
            message: `${player.display_name} оффлайн`,
            io
          });
          io.to(`party:${sess.party_id}`).emit("player:statusChanged", { playerId: sess.player_id, status: "offline", lastSeen: now() });
        });
      }

      return;
    }
  });

  return io;
}
