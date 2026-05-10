import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-arcade-session-dice-scrabble-"));
process.env.DND_LAN_DATA_DIR = tmpDir;

const { getDb, getSinglePartyId, initDb } = await import("../src/db.js");
const { ticketsRouter } = await import("../src/routes/tickets.js");
const { now } = await import("../src/util.js");
const { seedActiveArcadeActivity } = await import("./liveActivityTestHelper.js");

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

test("dice session start hides seed/proof and finish settles from server state", async () => {
  const playerId = createPlayer("Dice-Session");
  seedActiveArcadeActivity(playerId);
  const token = createSession(playerId);
  seedTickets(playerId, 20);

  const started = await api("/api/tickets/games/dice/start", {
    method: "POST",
    token,
    body: { modeKey: "single" }
  });

  assert.equal(started.res.status, 200);
  const snapshot = started.data?.arcadeSession;
  assert.ok(snapshot?.sessionId);
  assert.equal(snapshot.seed, undefined);
  assert.equal(snapshot.proof, undefined);
  assert.equal(snapshot.state.status, "playing");
  assert.equal(snapshot.state.allowReroll, false);
  assert.equal(snapshot.state.currentRoll.length, 5);
  assert.ok(snapshot.state.currentRoll.every((value) => Number.isInteger(value) && value >= 1 && value <= 6));

  const finished = await api(`/api/tickets/games/sessions/${snapshot.sessionId}/finish`, {
    method: "POST",
    token,
    body: {}
  });

  assert.equal(finished.res.status, 200);
  assert.equal(finished.data?.result?.gameKey, "dice");
  assert.ok(["win", "loss"].includes(finished.data?.result?.outcome));
  assert.equal(finished.data?.arcadeSession?.state?.status, finished.data?.result?.outcome);
});

test("dice session reroll is applied server-side once", async () => {
  const playerId = createPlayer("Dice-Reroll");
  seedActiveArcadeActivity(playerId);
  const token = createSession(playerId);
  seedTickets(playerId, 20);

  const started = await api("/api/tickets/games/dice/start", {
    method: "POST",
    token,
    body: { modeKey: "classic" }
  });
  assert.equal(started.res.status, 200);

  const sessionId = started.data?.arcadeSession?.sessionId;
  const moved = await api(`/api/tickets/games/sessions/${sessionId}/move`, {
    method: "POST",
    token,
    body: { rerollMask: [1, 0, 0, 0, 0] }
  });

  assert.equal(moved.res.status, 200);
  assert.equal(moved.data?.arcadeSession?.state?.rerolled, true);
  assert.deepEqual(moved.data?.arcadeSession?.state?.rerollMask, [1, 0, 0, 0, 0]);

  const secondMove = await api(`/api/tickets/games/sessions/${sessionId}/move`, {
    method: "POST",
    token,
    body: { rerollMask: [0, 1, 0, 0, 0] }
  });

  assert.equal(secondMove.res.status, 400);
  assert.equal(secondMove.data.error, "invalid_move");
});

test("scrabble session returns rack without seed/proof and settles submitted word", async () => {
  const playerId = createPlayer("Scrabble-Session");
  seedActiveArcadeActivity(playerId);
  const token = createSession(playerId);
  seedTickets(playerId, 20);

  const started = await api("/api/tickets/games/scrabble/start", {
    method: "POST",
    token,
    body: { modeKey: "normal" }
  });

  assert.equal(started.res.status, 200);
  const snapshot = started.data?.arcadeSession;
  assert.ok(snapshot?.sessionId);
  assert.equal(snapshot.seed, undefined);
  assert.equal(snapshot.proof, undefined);
  assert.equal(snapshot.state.status, "playing");
  assert.equal(snapshot.state.rack.length, 7);
  assert.ok(snapshot.state.rack.every((letter) => typeof letter === "string" && letter.length === 1));

  const playableWord = snapshot.state.rack.slice(0, 3).join("");
  const moved = await api(`/api/tickets/games/sessions/${snapshot.sessionId}/move`, {
    method: "POST",
    token,
    body: { word: playableWord }
  });

  assert.equal(moved.res.status, 200);
  assert.equal(moved.data?.arcadeSession?.state?.status, "win");
  assert.equal(moved.data?.arcadeSession?.state?.word, playableWord);

  const finished = await api(`/api/tickets/games/sessions/${snapshot.sessionId}/finish`, {
    method: "POST",
    token,
    body: {}
  });

  assert.equal(finished.res.status, 200);
  assert.equal(finished.data?.result?.gameKey, "scrabble");
  assert.equal(finished.data?.result?.outcome, "win");
});

test("scrabble session rejects invalid session on cross-player finish", async () => {
  const ownerId = createPlayer("Scrabble-Owner");
  const strangerId = createPlayer("Scrabble-Stranger");
  seedActiveArcadeActivity(ownerId);
  seedActiveArcadeActivity(strangerId);
  const ownerToken = createSession(ownerId);
  const strangerToken = createSession(strangerId);

  const started = await api("/api/tickets/games/scrabble/start", {
    method: "POST",
    token: ownerToken,
    body: { modeKey: "normal" }
  });
  assert.equal(started.res.status, 200);

  const out = await api(`/api/tickets/games/sessions/${started.data.arcadeSession.sessionId}/finish`, {
    method: "POST",
    token: strangerToken,
    body: {}
  });

  assert.equal(out.res.status, 404);
  assert.equal(out.data.error, "invalid_session");
});
