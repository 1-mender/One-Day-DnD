import express from "express";
import { dmAuthMiddleware, getDmCookieName, verifyDmToken } from "../auth.js";
import { getDb, getPartyId, getParty } from "../db.js";
import { now } from "../util.js";
import { logEvent } from "../events.js";
import { LIMITS } from "../limits.js";

export const playersRouter = express.Router();

function getPlayerFromToken(req) {
  const token = req.header("x-player-token");
  if (!token) return null;
  const db = getDb();
  const sess = db.prepare("SELECT * FROM sessions WHERE token=? AND revoked=0 AND expires_at>?").get(String(token), Date.now());
  if (!sess) return null;
  const player = db.prepare("SELECT * FROM players WHERE id=? AND banned=0").get(sess.player_id);
  if (!player) return null;
  return { sess, player };
}

function isDmRequest(req) {
  const token = req.cookies?.[getDmCookieName()];
  if (!token) return false;
  try {
    verifyDmToken(token);
    return true;
  } catch {
    return false;
  }
}

playersRouter.get("/", (req, res) => {
  const isDm = isDmRequest(req);
  const me = getPlayerFromToken(req);
  if (!isDm && !me) return res.status(401).json({ error: "not_authenticated" });

  const db = getDb();
  const partyId = getPartyId();
  const rows = db.prepare(
    `
    SELECT p.id,
           p.display_name as displayName,
           p.status,
           p.last_seen as lastSeen,
           CASE WHEN cp.player_id IS NULL THEN 0 ELSE 1 END as profileCreated
    FROM players p
    LEFT JOIN character_profiles cp ON cp.player_id = p.id
    WHERE p.party_id=? AND p.banned=0
    ORDER BY p.id
  `
  ).all(partyId);
  res.json({ items: rows });
});

playersRouter.get("/me", (req, res) => {
  const me = getPlayerFromToken(req);
  if (!me) return res.status(401).json({ error: "not_authenticated" });
  res.json({
    player: { id: me.player.id, displayName: me.player.display_name, partyId: me.player.party_id }
  });
});

playersRouter.get("/dm/list", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const partyId = getPartyId();
  const rows = db.prepare(
    `
    SELECT p.id,
           p.display_name as displayName,
           p.status,
           p.last_seen as lastSeen,
           p.created_at as createdAt,
           CASE WHEN cp.player_id IS NULL THEN 0 ELSE 1 END as profileCreated
    FROM players p
    LEFT JOIN character_profiles cp ON cp.player_id = p.id
    WHERE p.party_id=?
    ORDER BY p.id
  `
  ).all(partyId);
  res.json({ items: rows });
});

playersRouter.put("/dm/:id", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.id);
  if (!pid) return res.status(400).json({ error: "invalid_playerId" });

  const db = getDb();
  const player = db.prepare("SELECT id, party_id, display_name FROM players WHERE id=?").get(pid);
  if (!player) return res.status(404).json({ error: "not_found" });

  const name = String(req.body?.displayName || "").trim();
  if (!name) return res.status(400).json({ error: "name_required" });
  if (name.length > LIMITS.playerName) return res.status(400).json({ error: "name_too_long" });

  db.prepare("UPDATE players SET display_name=? WHERE id=?").run(name, pid);

  req.app.locals.io?.to("dm").emit("players:updated");
  req.app.locals.io?.to(`party:${player.party_id}`).emit("players:updated");

  logEvent({
    partyId: player.party_id ?? getParty().id,
    type: "player.updated",
    actorRole: "dm",
    actorName: "DM",
    targetType: "player",
    targetId: pid,
    message: `Переименован игрок: ${player.display_name} → ${name}`,
    data: { playerId: pid, from: player.display_name, to: name },
    io: req.app.locals.io
  });

  res.json({ ok: true });
});

playersRouter.delete("/dm/:id", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.id);
  if (!pid) return res.status(400).json({ error: "invalid_playerId" });

  const db = getDb();
  const player = db.prepare("SELECT id, party_id, display_name FROM players WHERE id=?").get(pid);
  if (!player) return res.status(404).json({ error: "not_found" });

  const t = now();
  const tx = db.transaction(() => {
    db.prepare("UPDATE sessions SET revoked=1 WHERE player_id=?").run(pid);
    db.prepare("UPDATE players SET status='offline', last_seen=? WHERE id=?").run(t, pid);
    db.prepare("DELETE FROM players WHERE id=?").run(pid);
  });
  tx();

  req.app.locals.io?.to(`player:${pid}`).emit("player:kicked");
  req.app.locals.io?.to(`player:${pid}`).disconnectSockets(true);
  req.app.locals.io?.to("dm").emit("players:updated");
  req.app.locals.io?.to(`party:${player.party_id}`).emit("players:updated");

  logEvent({
    partyId: player.party_id ?? getParty().id,
    type: "player.deleted",
    actorRole: "dm",
    actorName: "DM",
    targetType: "player",
    targetId: pid,
    message: `Удалён игрок: ${player.display_name || pid}`,
    data: { playerId: pid },
    io: req.app.locals.io
  });

  res.json({ ok: true });
});
