import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-arcade-session-ttt-"));
process.env.DND_LAN_DATA_DIR = tmpDir;

const { getDb, getSinglePartyId, initDb } = await import("../src/db.js");
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
  const partyId = getSinglePartyId();
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
  ).run(token, playerId, getSinglePartyId(), t, t + 24 * 60 * 60 * 1000, 0, 0, 0);
  return token;
}

function seedTickets(playerId, balance = 20) {
  const db = getDb();
  const t = now();
  db.prepare(
    "INSERT INTO tickets(player_id, balance, daily_earned, daily_spent, updated_at) VALUES(?,?,?,?,?)"
  ).run(playerId, balance, 0, 0, t);
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

test("ttt session move/finish runs server-side rounds and hides seed/proof", async () => {
  const playerId = createPlayer("Ttt-Session-Finish");
  const token = createSession(playerId);
  seedTickets(playerId, 20);

  const started = await api("/api/tickets/games/ttt/start", {
    method: "POST",
    token,
    body: { modeKey: "fast" }
  });

  assert.equal(started.res.status, 200);
  assert.ok(started.data?.arcadeSession?.sessionId);
  assert.equal(started.data.arcadeSession.seed, undefined);
  assert.equal(started.data.arcadeSession.proof, undefined);
  assert.deepEqual(started.data.arcadeSession.state.board, Array(9).fill(null));
  assert.equal(started.data.arcadeSession.state.status, "playing");

  const sessionId = started.data.arcadeSession.sessionId;

  const notReady = await api(`/api/tickets/games/sessions/${sessionId}/finish`, {
    method: "POST",
    token,
    body: {}
  });
  assert.equal(notReady.res.status, 400);
  assert.equal(notReady.data.error, "game_not_finished");

  let snapshot = started.data.arcadeSession;
  for (const index of [0, 1, 3]) {
    const moved = await api(`/api/tickets/games/sessions/${sessionId}/move`, {
      method: "POST",
      token,
      body: { index }
    });
    assert.equal(moved.res.status, 200);
    snapshot = moved.data.arcadeSession;
    if (snapshot.state.status !== "playing") break;
  }

  assert.equal(snapshot.state.status, "loss");
  assert.equal(snapshot.state.aiWins, 1);
  assert.deepEqual(snapshot.state.winnerLine, [2, 4, 6]);

  const finished = await api(`/api/tickets/games/sessions/${sessionId}/finish`, {
    method: "POST",
    token,
    body: {}
  });

  assert.equal(finished.res.status, 200);
  assert.equal(finished.data?.result?.gameKey, "ttt");
  assert.equal(finished.data?.result?.outcome, "loss");
  assert.equal(finished.data?.arcadeSession?.state?.status, "loss");
  assert.equal(finished.data?.arcadeSession?.state?.aiWins, 1);
  assert.deepEqual(finished.data?.arcadeSession?.state?.winnerLine, [2, 4, 6]);
});

test("ttt session rejects occupied cells", async () => {
  const playerId = createPlayer("Ttt-Invalid-Move");
  const token = createSession(playerId);

  const started = await api("/api/tickets/games/ttt/start", {
    method: "POST",
    token,
    body: { modeKey: "fast" }
  });
  assert.equal(started.res.status, 200);

  const sessionId = started.data?.arcadeSession?.sessionId;
  const firstMove = await api(`/api/tickets/games/sessions/${sessionId}/move`, {
    method: "POST",
    token,
    body: { index: 0 }
  });
  assert.equal(firstMove.res.status, 200);

  const duplicateMove = await api(`/api/tickets/games/sessions/${sessionId}/move`, {
    method: "POST",
    token,
    body: { index: 0 }
  });

  assert.equal(duplicateMove.res.status, 400);
  assert.equal(duplicateMove.data.error, "invalid_move");
});
