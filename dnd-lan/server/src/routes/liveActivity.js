import express from "express";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getSinglePartyId } from "../db.js";
import { getPlayerContextFromRequest } from "../sessionAuth.js";
import {
  LIVE_ACTIVITY_KINDS,
  closePlayerLiveActivity,
  getActivePlayerLiveActivity,
  openPlayerLiveActivity
} from "../playerActivities/service.js";
import { emitSinglePartyEvent } from "../singlePartyEmit.js";

export const liveActivityRouter = express.Router();

liveActivityRouter.get("/me", (req, res) => {
  const me = getPlayerContextFromRequest(req, { at: Date.now() });
  if (!me) return res.status(401).json({ error: "not_authenticated" });
  const activity = getActivePlayerLiveActivity(me.player.id, { db: getDb() });
  return res.json({ activity });
});

liveActivityRouter.post("/dm/player/:id/open", dmAuthMiddleware, (req, res) => {
  const playerId = Number(req.params.id || 0);
  if (!playerId) return res.status(400).json({ error: "invalid_playerId" });
  const db = getDb();
  const player = db.prepare("SELECT id, party_id FROM players WHERE id=? AND banned=0").get(playerId);
  if (!player) return res.status(404).json({ error: "not_found" });
  const kind = String(req.body?.kind || LIVE_ACTIVITY_KINDS.ARCADE);
  if (!Object.values(LIVE_ACTIVITY_KINDS).includes(kind)) {
    return res.status(400).json({ error: "invalid_live_activity_kind" });
  }
  const activity = openPlayerLiveActivity({
    db,
    playerId: player.id,
    partyId: player.party_id || getSinglePartyId(),
    kind,
    payload: req.body?.payload || {},
    openedBy: "dm"
  });
  req.app.locals.io?.to(`player:${player.id}`).emit("player:minigame:opened", { activity });
  emitSinglePartyEvent(req.app.locals.io, "players:updated", undefined, { partyId: player.party_id });
  return res.json({ ok: true, activity });
});

liveActivityRouter.post("/dm/player/:id/close", dmAuthMiddleware, (req, res) => {
  const playerId = Number(req.params.id || 0);
  if (!playerId) return res.status(400).json({ error: "invalid_playerId" });
  const db = getDb();
  const player = db.prepare("SELECT id, party_id FROM players WHERE id=?").get(playerId);
  if (!player) return res.status(404).json({ error: "not_found" });
  const kind = req.body?.kind == null ? null : String(req.body.kind || "");
  if (kind && !Object.values(LIVE_ACTIVITY_KINDS).includes(kind)) {
    return res.status(400).json({ error: "invalid_live_activity_kind" });
  }
  const activity = closePlayerLiveActivity({
    db,
    playerId: player.id,
    kind
  });
  req.app.locals.io?.to(`player:${player.id}`).emit("player:minigame:closed", { activity, kind: activity?.kind || kind || null });
  emitSinglePartyEvent(req.app.locals.io, "players:updated", undefined, { partyId: player.party_id });
  return res.json({ ok: true, activity });
});
