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
  const rows = db.prepare("SELECT id, display_name as displayName, status, last_seen as lastSeen FROM players WHERE party_id=? AND banned=0 ORDER BY id").all(partyId);
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
  const rows = db.prepare("SELECT id, display_name as displayName, status, last_seen as lastSeen, created_at as createdAt FROM players WHERE party_id=? ORDER BY id").all(partyId);
  res.json({ items: rows });
});
