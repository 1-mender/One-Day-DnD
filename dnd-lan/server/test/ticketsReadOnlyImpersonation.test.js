import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-tickets-readonly-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "test_secret";

const { getDb, initDb, getPartyId } = await import("../src/db.js");
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

function createSession(playerId, { impersonated = 0, impersonatedWrite = 0 } = {}) {
  const db = getDb();
  const t = now();
  const token = `tok_${playerId}_${t}`;
  const expiresAt = t + 7 * 24 * 60 * 60 * 1000;
  db.prepare(
    "INSERT INTO sessions(token, player_id, party_id, created_at, expires_at, revoked, impersonated, impersonated_write) VALUES(?,?,?,?,?,?,?,?)"
  ).run(token, playerId, getPartyId(), t, expiresAt, 0, impersonated, impersonatedWrite);
  return token;
}

async function api(pathname, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

test("Read-only impersonation blocks tickets writes", async () => {
  const playerId = createPlayer("Readonly Arcade");
  const token = createSession(playerId, { impersonated: 1, impersonatedWrite: 0 });

  for (const pathname of [
    "/api/tickets/matchmaking/queue",
    "/api/tickets/purchase"
  ]) {
    const out = await api(pathname, {
      method: "POST",
      headers: { "x-player-token": token },
      body: {}
    });
    assert.equal(out.res.status, 403);
    assert.equal(out.data.error, "read_only_impersonation");
  }
});
