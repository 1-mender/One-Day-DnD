import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-party-kick-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "test_secret";
process.env.DM_COOKIE = "dm_token_test";

const { getDb, getPartyId, initDb } = await import("../src/db.js");
const { signDmToken, createDmUser } = await import("../src/auth.js");
const { partyRouter } = await import("../src/routes/party.js");
const { now } = await import("../src/util.js");

initDb();
const dmUser = createDmUser("dm", "secret123");

const app = express();
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use("/api/party", partyRouter);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
});

function dmCookie() {
  const token = signDmToken(dmUser);
  return `${process.env.DM_COOKIE}=${token}`;
}

function createPlayer(displayName = "Player") {
  const db = getDb();
  const partyId = getPartyId();
  const t = now();
  return db.prepare(
    "INSERT INTO players(party_id, display_name, status, last_seen, banned, created_at) VALUES(?,?,?,?,?,?)"
  ).run(partyId, displayName, "online", t, 0, t).lastInsertRowid;
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

async function api(pathname, { method = "GET", body } = {}) {
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      cookie: dmCookie()
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

test("kick returns 404 for missing player", async () => {
  const out = await api("/api/party/kick", {
    method: "POST",
    body: { playerId: 999999 }
  });
  assert.equal(out.res.status, 404);
  assert.equal(out.data.error, "not_found");
});

test("kick revokes sessions for existing player", async () => {
  const playerId = createPlayer("Kick Me");
  const token = createSession(playerId);
  assert.ok(token.length > 0);

  const out = await api("/api/party/kick", {
    method: "POST",
    body: { playerId }
  });
  assert.equal(out.res.status, 200);
  assert.equal(out.data.ok, true);

  const db = getDb();
  const sess = db.prepare("SELECT revoked FROM sessions WHERE player_id=?").get(playerId);
  assert.equal(Number(sess?.revoked || 0), 1);
});
