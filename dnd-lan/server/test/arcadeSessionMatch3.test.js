import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-arcade-session-match3-"));
process.env.DND_LAN_DATA_DIR = tmpDir;

const { getDb, getSinglePartyId, initDb } = await import("../src/db.js");
const { ticketsRouter } = await import("../src/routes/tickets.js");
const { now } = await import("../src/util.js");
const { findFirstMatch3ValidMove } = await import("../../shared/match3Domain.js");

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

test("match3 session start hides seed/proof and finish settles from server replay", async () => {
  const playerId = createPlayer("Match3-Session");
  const token = createSession(playerId);
  seedTickets(playerId, 20);

  const started = await api("/api/tickets/games/match3/start", {
    method: "POST",
    token,
    body: { modeKey: "compact" }
  });

  assert.equal(started.res.status, 200);
  let snapshot = started.data?.arcadeSession;
  assert.ok(snapshot?.sessionId);
  assert.equal(snapshot.seed, undefined);
  assert.equal(snapshot.proof, undefined);
  assert.equal(snapshot.state.status, "playing");
  assert.equal(snapshot.state.size, 5);
  assert.equal(snapshot.state.target, 90);
  assert.equal(snapshot.state.board.length, 25);

  const earlyFinish = await api(`/api/tickets/games/sessions/${snapshot.sessionId}/finish`, {
    method: "POST",
    token,
    body: {}
  });
  assert.equal(earlyFinish.res.status, 400);
  assert.equal(earlyFinish.data.error, "game_not_finished");

  let guard = 0;
  while (snapshot.state.status === "playing" && guard < 30) {
    const move = findFirstMatch3ValidMove({
      board: snapshot.state.board,
      config: { size: snapshot.state.size }
    });
    assert.ok(move, "expected a valid match3 move from public snapshot");

    const moved = await api(`/api/tickets/games/sessions/${snapshot.sessionId}/move`, {
      method: "POST",
      token,
      body: move
    });

    assert.equal(moved.res.status, 200);
    snapshot = moved.data?.arcadeSession;
    assert.ok(snapshot?.state?.board?.length > 0);
    guard += 1;
  }

  assert.ok(["win", "loss"].includes(snapshot.state.status));

  const finished = await api(`/api/tickets/games/sessions/${snapshot.sessionId}/finish`, {
    method: "POST",
    token,
    body: {}
  });

  assert.equal(finished.res.status, 200);
  assert.equal(finished.data?.result?.gameKey, "match3");
  assert.equal(finished.data?.result?.outcome, snapshot.state.status);
  assert.ok(finished.data?.state);
});

test("match3 session rejects invalid move coordinates", async () => {
  const playerId = createPlayer("Match3-Invalid-Move");
  const token = createSession(playerId);

  const started = await api("/api/tickets/games/match3/start", {
    method: "POST",
    token,
    body: { modeKey: "compact" }
  });
  assert.equal(started.res.status, 200);

  const out = await api(`/api/tickets/games/sessions/${started.data.arcadeSession.sessionId}/move`, {
    method: "POST",
    token,
    body: { from: 0, to: 0 }
  });

  assert.equal(out.res.status, 400);
  assert.equal(out.data.error, "invalid_move");
});
