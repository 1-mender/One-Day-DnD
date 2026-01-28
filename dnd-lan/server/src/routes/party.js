import express from "express";
import rateLimit from "express-rate-limit";
import { getDb, getParty } from "../db.js";
import { randId, now } from "../util.js";
import { dmAuthMiddleware } from "../auth.js";
import { logEvent } from "../events.js";

export const partyRouter = express.Router();

const joinLimiter = rateLimit({
  windowMs: 10_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});

partyRouter.post("/join-request", joinLimiter, (req, res) => {
  const db = getDb();
  const party = getParty();
  const { displayName, joinCode } = req.body || {};
  const name = String(displayName || "").trim();
  if (!name) return res.status(400).json({ error: "name_required" });

  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket.remoteAddress || "";
  const banned = db.prepare("SELECT 1 FROM banned_ips WHERE ip=?").get(ip);
  if (banned) return res.status(403).json({ error: "banned" });

  if (party.join_code) {
    if (String(joinCode || "") !== String(party.join_code)) return res.status(403).json({ error: "bad_join_code" });
  }

  const id = randId(20);
  db.prepare("INSERT INTO join_requests(id, party_id, display_name, ip, user_agent, created_at) VALUES(?,?,?,?,?,?)")
    .run(id, party.id, name, ip, req.headers["user-agent"] || "", now());

  req.app.locals.io?.to("dm").emit("player:joinRequested", { id, displayName: name, ip, ua: req.headers["user-agent"] || "", createdAt: now() });
  return res.json({ ok: true, joinRequestId: id });
});

partyRouter.get("/requests", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM join_requests ORDER BY created_at DESC").all();
  res.json({ items: rows });
});

partyRouter.post("/approve", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const { joinRequestId } = req.body || {};
  const jr = db.prepare("SELECT * FROM join_requests WHERE id=?").get(String(joinRequestId || ""));
  if (!jr) return res.status(404).json({ error: "not_found" });

  // create player
  const t = now();
  const playerId = db.prepare("INSERT INTO players(party_id, display_name, status, last_seen, banned, created_at) VALUES(?,?,?,?,?,?)")
    .run(jr.party_id, jr.display_name, "offline", t, 0, t).lastInsertRowid;

  // create session token
  const ttlDays = Number(process.env.PLAYER_TOKEN_TTL_DAYS || 14);
  const expiresAt = t + ttlDays * 24 * 60 * 60 * 1000;
  const token = randId(48);
  db.prepare(
    "INSERT INTO sessions(token, player_id, party_id, created_at, expires_at, revoked, impersonated, impersonated_write) VALUES(?,?,?,?,?,0,0,0)"
  ).run(token, playerId, jr.party_id, t, expiresAt);

  // delete join request
  db.prepare("DELETE FROM join_requests WHERE id=?").run(jr.id);

  // notify waiting client
  req.app.locals.io?.to(`joinreq:${jr.id}`).emit("player:approved", { playerToken: token, playerId, partyId: jr.party_id, displayName: jr.display_name });
  // notify dm & party
  req.app.locals.io?.to("dm").emit("player:approved", { playerId, displayName: jr.display_name });
  req.app.locals.io?.to(`party:${jr.party_id}`).emit("players:updated");

  logEvent({
    partyId: jr.party_id,
    type: "join.approved",
    actorRole: "dm",
    actorName: "DM",
    targetType: "player",
    targetId: Number(playerId),
    message: `Принят игрок: ${jr.display_name}`,
    data: { joinRequestId: jr.id, ip: jr.ip },
    io: req.app.locals.io
  });

  res.json({ ok: true, playerId, playerToken: token });
});

partyRouter.post("/reject", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const { joinRequestId } = req.body || {};
  const jr = db.prepare("SELECT * FROM join_requests WHERE id=?").get(String(joinRequestId || ""));
  if (!jr) return res.status(404).json({ error: "not_found" });
  db.prepare("DELETE FROM join_requests WHERE id=?").run(jr.id);
  req.app.locals.io?.to(`joinreq:${jr.id}`).emit("player:rejected", { joinRequestId: jr.id });
  req.app.locals.io?.to("dm").emit("player:rejected", { joinRequestId: jr.id });
  logEvent({
    partyId: jr.party_id,
    type: "join.rejected",
    actorRole: "dm",
    actorName: "DM",
    targetType: "join_request",
    targetId: null,
    message: `Отклонён запрос: ${jr.display_name}`,
    data: { joinRequestId: jr.id, ip: jr.ip },
    io: req.app.locals.io
  });
  res.json({ ok: true });
});

partyRouter.post("/ban", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const { joinRequestId } = req.body || {};
  const jr = db.prepare("SELECT * FROM join_requests WHERE id=?").get(String(joinRequestId || ""));
  if (!jr) return res.status(404).json({ error: "not_found" });
  if (jr.ip) db.prepare("INSERT OR IGNORE INTO banned_ips(ip, created_at) VALUES(?,?)").run(jr.ip, now());
  db.prepare("DELETE FROM join_requests WHERE id=?").run(jr.id);
  req.app.locals.io?.to(`joinreq:${jr.id}`).emit("player:rejected", { joinRequestId: jr.id, banned: true });
  req.app.locals.io?.to("dm").emit("player:banned", { ip: jr.ip, joinRequestId: jr.id });
  logEvent({
    partyId: jr.party_id,
    type: "join.banned",
    actorRole: "dm",
    actorName: "DM",
    targetType: "join_request",
    targetId: null,
    message: `Заблокирован IP/запрос: ${jr.display_name}`,
    data: { joinRequestId: jr.id, ip: jr.ip },
    io: req.app.locals.io
  });
  res.json({ ok: true });
});

partyRouter.post("/kick", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const { playerId } = req.body || {};
  const pid = Number(playerId);
  if (!pid) return res.status(400).json({ error: "invalid_playerId" });

  const p = db.prepare("SELECT id, party_id, display_name FROM players WHERE id=?").get(pid);
  db.prepare("UPDATE sessions SET revoked=1 WHERE player_id=?").run(pid);
  db.prepare("UPDATE players SET status='offline', last_seen=? WHERE id=?").run(now(), pid);

  req.app.locals.io?.to(`player:${pid}`).emit("player:kicked");
  req.app.locals.io?.to(`player:${pid}`).disconnectSockets(true);
  req.app.locals.io?.to("dm").emit("players:updated");
  logEvent({
    partyId: p?.party_id ?? getParty().id,
    type: "player.kicked",
    actorRole: "dm",
    actorName: "DM",
    targetType: "player",
    targetId: pid,
    message: `Кикнут игрок: ${p?.display_name || pid}`,
    data: { playerId: pid },
    io: req.app.locals.io
  });
  res.json({ ok: true });
});

partyRouter.get("/join-code", dmAuthMiddleware, (req, res) => {
  const party = getParty();
  res.json({
    enabled: !!party.join_code,
    joinCode: party.join_code || ""
  });
});

partyRouter.post("/join-code", dmAuthMiddleware, (req, res) => {
  const { joinCode } = req.body || {};
  const party = getParty();
  getDb().prepare("UPDATE parties SET join_code=? WHERE id=?").run(joinCode ? String(joinCode) : null, party.id);
  req.app.locals.io?.to("dm").emit("settings:updated");
  req.app.locals.io?.to(`party:${party.id}`).emit("settings:updated");
  res.json({ ok: true });
});

partyRouter.post("/impersonate", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const { playerId, mode } = req.body || {};
  const pid = Number(playerId);
  if (!pid) return res.status(400).json({ error: "invalid_playerId" });

  const player = db.prepare("SELECT * FROM players WHERE id=? AND banned=0").get(pid);
  if (!player) return res.status(404).json({ error: "player_not_found" });

  const write = String(mode || "ro").toLowerCase() === "rw" ? 1 : 0;

  const t = now();
  const expiresAt = t + 2 * 60 * 60 * 1000;
  const token = randId(48);

  db.prepare(
    "INSERT INTO sessions(token, player_id, party_id, created_at, expires_at, revoked, impersonated, impersonated_write) VALUES(?,?,?,?,?,0,1,?)"
  ).run(token, pid, player.party_id, t, expiresAt, write);

  res.json({ ok: true, playerToken: token, expiresAt, canWrite: !!write });
});
