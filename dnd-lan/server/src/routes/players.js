import express from "express";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getPartyId } from "../db.js";

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

playersRouter.get("/", (req, res) => {
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
