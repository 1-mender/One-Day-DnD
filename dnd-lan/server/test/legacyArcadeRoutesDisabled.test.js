import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-legacy-arcade-disabled-"));
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

function createPlayer() {
  const db = getDb();
  const partyId = getSinglePartyId();
  const t = now();
  return db.prepare(
    "INSERT INTO players(party_id, display_name, status, last_seen, banned, created_at) VALUES(?,?,?,?,?,?)"
  ).run(partyId, "Legacy-Off", "offline", t, 0, t).lastInsertRowid;
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

test("legacy /seed route is disabled for authenticated players", async () => {
  const playerId = createPlayer();
  const token = createSession(playerId);

  const out = await api("/api/tickets/seed?gameKey=ttt", { token });

  assert.equal(out.res.status, 410);
  assert.equal(out.data.error, "legacy_arcade_api_disabled");
});

test("legacy /play route is disabled for authenticated players", async () => {
  const playerId = createPlayer();
  const token = createSession(playerId);

  const out = await api("/api/tickets/play", {
    method: "POST",
    token,
    body: {
      gameKey: "ttt",
      outcome: "win",
      performance: "normal",
      payload: {}
    }
  });

  assert.equal(out.res.status, 410);
  assert.equal(out.data.error, "legacy_arcade_api_disabled");
});
