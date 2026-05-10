import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-ticket-bulk-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "test_secret";
process.env.DM_COOKIE = "dm_token_test";

const { getDb, initDb, getSinglePartyId } = await import("../src/db.js");
const { signDmToken, createDmUser } = await import("../src/auth.js");
const { ticketsRouter } = await import("../src/routes/tickets.js");
const { now } = await import("../src/util.js");

initDb();
const dmUser = createDmUser("dm", "secret123");

const app = express();
app.locals.io = {
  to() {
    return { emit() {} };
  }
};
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use("/api/tickets", ticketsRouter);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
});

function dmCookie() {
  const token = signDmToken(dmUser);
  return `${process.env.DM_COOKIE}=${token}`;
}

function createPlayer(displayName = "Bulk Player") {
  const db = getDb();
  const partyId = getSinglePartyId();
  const t = now();
  return Number(db.prepare(
    "INSERT INTO players(party_id, display_name, status, last_seen, banned, created_at) VALUES(?,?,?,?,?,?)"
  ).run(partyId, displayName, "offline", t, 0, t).lastInsertRowid);
}

function seedTickets(playerId, balance = 0) {
  const db = getDb();
  const t = now();
  db.prepare(
    "INSERT INTO tickets(player_id, balance, streak, daily_earned, daily_spent, day_key, last_played_at, updated_at) VALUES(?,?,?,?,?,?,?,?)"
  ).run(playerId, balance, 0, 0, 0, 0, null, t);
}

async function api(pathname, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      cookie: dmCookie(),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

test("bulk ticket adjust updates multiple players and deduplicates ids", async () => {
  const playerA = createPlayer("Bulk A");
  const playerB = createPlayer("Bulk B");
  seedTickets(playerA, 2);
  seedTickets(playerB, 5);

  const out = await api("/api/tickets/dm/adjust-bulk", {
    method: "POST",
    body: {
      playerIds: [playerA, playerB, playerA],
      delta: 3,
      reason: "scene reward"
    }
  });

  assert.equal(out.res.status, 200);
  assert.equal(out.data.appliedCount, 2);
  assert.equal(out.data.failedCount, 0);
  assert.equal(out.data.skippedCount, 1);
  assert.equal(out.data.items.length, 2);

  const db = getDb();
  const rowA = db.prepare("SELECT balance FROM tickets WHERE player_id=?").get(playerA);
  const rowB = db.prepare("SELECT balance FROM tickets WHERE player_id=?").get(playerB);
  assert.equal(Number(rowA.balance), 5);
  assert.equal(Number(rowB.balance), 8);
});

test("bulk ticket adjust reports per-player failures and keeps successful updates", async () => {
  const playerA = createPlayer("Mixed A");
  const missingPlayer = 999999;
  seedTickets(playerA, 4);

  const out = await api("/api/tickets/dm/adjust-bulk", {
    method: "POST",
    body: {
      playerIds: [playerA, missingPlayer],
      delta: -2,
      reason: "correction"
    }
  });

  assert.equal(out.res.status, 200);
  assert.equal(out.data.appliedCount, 1);
  assert.equal(out.data.failedCount, 1);
  assert.deepEqual(out.data.items, [
    {
      playerId: playerA,
      displayName: "Mixed A",
      ok: true,
      balance: 2,
      streak: 0
    },
    {
      playerId: missingPlayer,
      ok: false,
      error: "player_not_found"
    }
  ]);

  const db = getDb();
  const rowA = db.prepare("SELECT balance FROM tickets WHERE player_id=?").get(playerA);
  assert.equal(Number(rowA.balance), 2);
});
