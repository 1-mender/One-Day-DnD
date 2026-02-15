import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-matchmaking-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.ARCADE_QUEUE_TTL_MS = "120000";

const { getDb, getPartyId, initDb } = await import("../src/db.js");
const { ticketsRouter } = await import("../src/routes/tickets.js");
const { now } = await import("../src/util.js");

initDb();

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use("/api/tickets", ticketsRouter);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
});

function createPlayer(displayName = "Player") {
  const db = getDb();
  const partyId = getPartyId();
  const t = now();
  return db.prepare(
    "INSERT INTO players(party_id, display_name, status, last_seen, banned, created_at) VALUES(?,?,?,?,?,?)"
  ).run(partyId, displayName, "offline", t, 0, t).lastInsertRowid;
}

function createSession(playerId) {
  const db = getDb();
  const t = now();
  const token = `tok_${playerId}_${t}`;
  db.prepare(
    "INSERT INTO sessions(token, player_id, party_id, created_at, expires_at, revoked, impersonated, impersonated_write) VALUES(?,?,?,?,?,?,?,?)"
  ).run(token, playerId, getPartyId(), t, t + 24 * 60 * 60 * 1000, 0, 0, 0);
  return token;
}

async function api(pathname, { method = "GET", token = "", body } = {}) {
  const headers = {};
  if (token) headers["x-player-token"] = token;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

test("queue join + auto match for same game/mode", async () => {
  const p1 = createPlayer("Queue-A");
  const p2 = createPlayer("Queue-B");
  const t1 = createSession(p1);
  const t2 = createSession(p2);

  const q1 = await api("/api/tickets/matchmaking/queue", {
    method: "POST",
    token: t1,
    body: { gameKey: "ttt" }
  });
  assert.equal(q1.res.status, 200);
  assert.equal(q1.data?.matchmakingAction?.status, "queued");
  assert.equal(!!q1.data?.matchmaking?.activeQueue, true);

  const q2 = await api("/api/tickets/matchmaking/queue", {
    method: "POST",
    token: t2,
    body: { gameKey: "ttt" }
  });
  assert.equal(q2.res.status, 200);
  assert.equal(q2.data?.matchmakingAction?.status, "matched");

  const db = getDb();
  const matchCount = db.prepare("SELECT COUNT(*) AS c FROM arcade_matches").get()?.c || 0;
  const matchedQueues = db.prepare("SELECT COUNT(*) AS c FROM arcade_match_queue WHERE status='matched'").get()?.c || 0;
  assert.equal(matchCount, 1);
  assert.equal(matchedQueues, 2);
});

test("queue cancel removes active queue", async () => {
  const p = createPlayer("Queue-Cancel");
  const token = createSession(p);

  const q = await api("/api/tickets/matchmaking/queue", {
    method: "POST",
    token,
    body: { gameKey: "ttt" }
  });
  assert.equal(q.res.status, 200);
  assert.equal(q.data?.matchmakingAction?.status, "queued");

  const cancel = await api("/api/tickets/matchmaking/cancel", {
    method: "POST",
    token,
    body: {}
  });
  assert.equal(cancel.res.status, 200);
  assert.equal(cancel.data?.matchmakingAction?.status, "canceled");
  assert.equal(cancel.data?.matchmaking?.activeQueue, null);
});

test("rematch creates second match with rematch_of", async () => {
  const p1 = createPlayer("Rematch-A");
  const p2 = createPlayer("Rematch-B");
  const t1 = createSession(p1);
  const t2 = createSession(p2);

  const q1 = await api("/api/tickets/matchmaking/queue", {
    method: "POST",
    token: t1,
    body: { gameKey: "ttt" }
  });
  assert.equal(q1.res.status, 200);

  const q2 = await api("/api/tickets/matchmaking/queue", {
    method: "POST",
    token: t2,
    body: { gameKey: "ttt" }
  });
  assert.equal(q2.res.status, 200);
  assert.equal(q2.data?.matchmakingAction?.status, "matched");

  const hist1 = await api("/api/tickets/matches/history?limit=1", { token: t1 });
  assert.equal(hist1.res.status, 200);
  assert.equal(Array.isArray(hist1.data?.items), true);
  const firstMatchId = Number(hist1.data.items?.[0]?.matchId || 0);
  assert.ok(firstMatchId > 0);

  const rematch1 = await api(`/api/tickets/matches/${firstMatchId}/rematch`, {
    method: "POST",
    token: t1
  });
  assert.equal(rematch1.res.status, 200);
  assert.equal(rematch1.data?.matchmakingAction?.status, "queued");

  const rematch2 = await api(`/api/tickets/matches/${firstMatchId}/rematch`, {
    method: "POST",
    token: t2
  });
  assert.equal(rematch2.res.status, 200);
  assert.equal(rematch2.data?.matchmakingAction?.status, "matched");

  const db = getDb();
  const rows = db.prepare("SELECT id, rematch_of FROM arcade_matches ORDER BY id ASC").all();
  assert.ok(rows.length >= 2);
  const last = rows[rows.length - 1];
  assert.equal(Number(last.rematch_of), firstMatchId);
});

test("match complete rejects client-provided winner", async () => {
  const p1 = createPlayer("Complete-A");
  const p2 = createPlayer("Complete-B");
  const t1 = createSession(p1);
  const t2 = createSession(p2);

  const q1 = await api("/api/tickets/matchmaking/queue", {
    method: "POST",
    token: t1,
    body: { gameKey: "ttt" }
  });
  assert.equal(q1.res.status, 200);

  const q2 = await api("/api/tickets/matchmaking/queue", {
    method: "POST",
    token: t2,
    body: { gameKey: "ttt" }
  });
  assert.equal(q2.res.status, 200);
  assert.equal(q2.data?.matchmakingAction?.status, "matched");

  const matchId = Number(q2.data?.matchmakingAction?.matchId || 0);
  assert.ok(matchId > 0);

  const complete = await api(`/api/tickets/matches/${matchId}/complete`, {
    method: "POST",
    token: t1,
    body: { winnerPlayerId: p1, durationMs: 120000 }
  });
  assert.equal(complete.res.status, 403);
  assert.equal(complete.data.error, "winner_locked");
});
