import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-arcade-session-guess-"));
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
    `INSERT INTO tickets(player_id, balance, daily_earned, daily_spent, updated_at)
     VALUES(?,?,?,?,?)
     ON CONFLICT(player_id) DO UPDATE SET balance=excluded.balance, updated_at=excluded.updated_at`
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

test("guess session start hides seed/proof and unrevealed card identities", async () => {
  const playerId = createPlayer("Guess-Session-Start");
  const token = createSession(playerId);

  const out = await api("/api/tickets/games/guess/start", {
    method: "POST",
    token,
    body: { modeKey: "normal" }
  });

  assert.equal(out.res.status, 200);
  assert.ok(out.data?.arcadeSession?.sessionId);
  assert.equal(out.data.arcadeSession.seed, undefined);
  assert.equal(out.data.arcadeSession.proof, undefined);
  assert.equal(out.data.arcadeSession.state.status, "playing");
  assert.ok(Array.isArray(out.data.arcadeSession.state.deck));
  assert.ok(out.data.arcadeSession.state.deck.length > 0);
  assert.equal(out.data.arcadeSession.state.deck[0].revealed, false);
  assert.equal(out.data.arcadeSession.state.deck[0].suit, undefined);
  assert.equal(out.data.arcadeSession.state.deck[0].rank, undefined);
});

test("guess session move/finish settles from server state without client seed/proof", async () => {
  const playerId = createPlayer("Guess-Session-Finish");
  const token = createSession(playerId);
  seedTickets(playerId, 20);

  const started = await api("/api/tickets/games/guess/start", {
    method: "POST",
    token,
    body: { modeKey: "easy" }
  });
  assert.equal(started.res.status, 200);

  let snapshot = started.data.arcadeSession;
  const sessionId = snapshot.sessionId;
  assert.ok(sessionId);

  const notReady = await api(`/api/tickets/games/sessions/${sessionId}/finish`, {
    method: "POST",
    token,
    body: {}
  });
  assert.equal(notReady.res.status, 400);
  assert.equal(notReady.data.error, "game_not_finished");

  for (const card of snapshot.state.deck) {
    const moved = await api(`/api/tickets/games/sessions/${sessionId}/move`, {
      method: "POST",
      token,
      body: { cardId: card.id }
    });
    assert.equal(moved.res.status, 200);
    snapshot = moved.data.arcadeSession;
    if (snapshot.state.status !== "playing") break;
  }

  assert.ok(["win", "loss"].includes(snapshot.state.status));

  const finished = await api(`/api/tickets/games/sessions/${sessionId}/finish`, {
    method: "POST",
    token,
    body: {}
  });

  assert.equal(finished.res.status, 200);
  assert.equal(finished.data?.result?.gameKey, "guess");
  assert.equal(finished.data?.result?.outcome, snapshot.state.status);
  assert.ok(finished.data?.state);
  assert.ok(Array.isArray(finished.data?.arcadeSession?.state?.deck));
  assert.ok(finished.data.arcadeSession.state.deck.every((card) => card.revealed === true));
  assert.ok(finished.data.arcadeSession.state.target?.suit);
  assert.ok(finished.data.arcadeSession.state.target?.rank);
});

test("guess session is scoped to owning player", async () => {
  const ownerId = createPlayer("Guess-Owner");
  const strangerId = createPlayer("Guess-Stranger");
  const ownerToken = createSession(ownerId);
  const strangerToken = createSession(strangerId);

  const started = await api("/api/tickets/games/guess/start", {
    method: "POST",
    token: ownerToken,
    body: { modeKey: "easy" }
  });
  assert.equal(started.res.status, 200);

  const sessionId = started.data?.arcadeSession?.sessionId;
  const out = await api(`/api/tickets/games/sessions/${sessionId}/move`, {
    method: "POST",
    token: strangerToken,
    body: { cardId: started.data.arcadeSession.state.deck[0].id }
  });

  assert.equal(out.res.status, 404);
  assert.equal(out.data.error, "invalid_session");
});

test("failed guess settlement keeps finished session retryable", async () => {
  const playerId = createPlayer("Guess-Settlement-Retry");
  const token = createSession(playerId);

  const started = await api("/api/tickets/games/guess/start", {
    method: "POST",
    token,
    body: { modeKey: "normal" }
  });
  assert.equal(started.res.status, 200);

  let snapshot = started.data.arcadeSession;
  const sessionId = snapshot.sessionId;

  for (const card of snapshot.state.deck) {
    const moved = await api(`/api/tickets/games/sessions/${sessionId}/move`, {
      method: "POST",
      token,
      body: { cardId: card.id }
    });
    assert.equal(moved.res.status, 200);
    snapshot = moved.data.arcadeSession;
    if (snapshot.state.status !== "playing") break;
  }

  const failedFinish = await api(`/api/tickets/games/sessions/${sessionId}/finish`, {
    method: "POST",
    token,
    body: {}
  });
  assert.equal(failedFinish.res.status, 400);
  assert.equal(failedFinish.data.error, "not_enough_tickets");

  seedTickets(playerId, 10);

  const retriedFinish = await api(`/api/tickets/games/sessions/${sessionId}/finish`, {
    method: "POST",
    token,
    body: {}
  });
  assert.equal(retriedFinish.res.status, 200);
  assert.equal(retriedFinish.data?.result?.gameKey, "guess");
  assert.equal(retriedFinish.data?.result?.outcome, snapshot.state.status);
});
