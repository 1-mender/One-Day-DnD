import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "test_secret";
process.env.DM_COOKIE = "dm_token_test";

const { getDb, initDb, getPartyId } = await import("../src/db.js");
const { signDmToken, createDmUser } = await import("../src/auth.js");
const { profileRouter } = await import("../src/routes/profile.js");
const { now } = await import("../src/util.js");

initDb();
const dmUser = createDmUser("dm", "secret123");

const app = express();
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use("/api", profileRouter);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
});

function dmCookie() {
  const token = signDmToken(dmUser);
  return `${process.env.DM_COOKIE}=${token}`;
}

function createPlayer(displayName = "Player One") {
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

test("DM can create profile and player can patch allowed fields", async () => {
  const playerId = createPlayer();
  const dmHeaders = { cookie: dmCookie() };

  const createRes = await api(`/api/players/${playerId}/profile`, {
    method: "PUT",
    headers: dmHeaders,
    body: {
      characterName: "Alice",
      classRole: "Rogue",
      level: 2,
      stats: { str: 10, dex: 14 },
      bio: "Backstory",
      editableFields: ["bio"],
      allowRequests: true
    }
  });

  assert.equal(createRes.res.status, 200);
  assert.equal(createRes.data.profile.characterName, "Alice");

  const token = createSession(playerId);

  const okPatch = await api(`/api/players/${playerId}/profile`, {
    method: "PATCH",
    headers: { "x-player-token": token },
    body: { bio: "Updated" }
  });
  assert.equal(okPatch.res.status, 200);
  assert.equal(okPatch.data.profile.bio, "Updated");

  const badPatch = await api(`/api/players/${playerId}/profile`, {
    method: "PATCH",
    headers: { "x-player-token": token },
    body: { stats: { str: 18 } }
  });
  assert.equal(badPatch.res.status, 403);
});

test("Player can create request with reason and DM can approve", async () => {
  const playerId = createPlayer("Player Two");
  const token = createSession(playerId);
  const dmHeaders = { cookie: dmCookie() };

  await api(`/api/players/${playerId}/profile`, {
    method: "PUT",
    headers: dmHeaders,
    body: { characterName: "Bob", allowRequests: true }
  });

  const reqRes = await api(`/api/players/${playerId}/profile-requests`, {
    method: "POST",
    headers: { "x-player-token": token },
    body: {
      proposedChanges: { bio: "Please update" },
      reason: "Story arc"
    }
  });
  assert.equal(reqRes.res.status, 200);

  const playerReqs = await api(`/api/players/${playerId}/profile-requests?limit=5`, {
    headers: { "x-player-token": token }
  });
  assert.equal(playerReqs.res.status, 200);
  assert.equal(playerReqs.data.items[0].reason, "Story arc");

  const listRes = await api("/api/profile-requests?status=pending", { headers: dmHeaders });
  assert.equal(listRes.res.status, 200);
  assert.ok(listRes.data.items.find((x) => x.playerId === playerId));

  const requestId = listRes.data.items.find((x) => x.playerId === playerId).id;
  const approveRes = await api(`/api/profile-requests/${requestId}/approve`, {
    method: "POST",
    headers: dmHeaders,
    body: { note: "OK" }
  });
  assert.equal(approveRes.res.status, 200);
});

test("Validation rejects long bio", async () => {
  const playerId = createPlayer("Player Three");
  const dmHeaders = { cookie: dmCookie() };
  const longBio = "x".repeat(2100);

  const res = await api(`/api/players/${playerId}/profile`, {
    method: "PUT",
    headers: dmHeaders,
    body: { characterName: "Long", bio: longBio }
  });
  assert.equal(res.res.status, 400);
  assert.equal(res.data.error, "bio_too_long");
});

test("Validation rejects invalid stats type", async () => {
  const playerId = createPlayer("Bad Stats");
  const dmHeaders = { cookie: dmCookie() };

  const res = await api(`/api/players/${playerId}/profile`, {
    method: "PUT",
    headers: dmHeaders,
    body: { characterName: "Bad", stats: "nope" }
  });
  assert.equal(res.res.status, 400);
  assert.equal(res.data.error, "stats_invalid");
});

test("Player cannot edit or request when impersonation is read-only", async () => {
  const playerId = createPlayer("Impersonated");
  const dmHeaders = { cookie: dmCookie() };

  await api(`/api/players/${playerId}/profile`, {
    method: "PUT",
    headers: dmHeaders,
    body: { characterName: "Imp", editableFields: ["bio"], allowRequests: true }
  });

  const token = createSession(playerId, { impersonated: 1, impersonatedWrite: 0 });

  const patchRes = await api(`/api/players/${playerId}/profile`, {
    method: "PATCH",
    headers: { "x-player-token": token },
    body: { bio: "Nope" }
  });
  assert.equal(patchRes.res.status, 403);
  assert.equal(patchRes.data.error, "read_only_impersonation");

  const reqRes = await api(`/api/players/${playerId}/profile-requests`, {
    method: "POST",
    headers: { "x-player-token": token },
    body: { proposedChanges: { bio: "Request" }, reason: "Test" }
  });
  assert.equal(reqRes.res.status, 403);
  assert.equal(reqRes.data.error, "read_only_impersonation");
});

test("Requests disabled returns 403 and profile_not_created returns 404", async () => {
  const playerId = createPlayer("ReqOff");
  const dmHeaders = { cookie: dmCookie() };

  await api(`/api/players/${playerId}/profile`, {
    method: "PUT",
    headers: dmHeaders,
    body: { characterName: "ReqOff", allowRequests: false }
  });

  const token = createSession(playerId);
  const reqRes = await api(`/api/players/${playerId}/profile-requests`, {
    method: "POST",
    headers: { "x-player-token": token },
    body: { proposedChanges: { bio: "Request" } }
  });
  assert.equal(reqRes.res.status, 403);
  assert.equal(reqRes.data.error, "requests_disabled");

  const otherId = createPlayer("NoProfile");
  const otherToken = createSession(otherId);
  const patchRes = await api(`/api/players/${otherId}/profile`, {
    method: "PATCH",
    headers: { "x-player-token": otherToken },
    body: { bio: "Missing profile" }
  });
  assert.equal(patchRes.res.status, 404);
  assert.equal(patchRes.data.error, "profile_not_created");
});

test("Player cannot read another player's profile", async () => {
  const playerA = createPlayer("Reader A");
  const playerB = createPlayer("Reader B");
  const dmHeaders = { cookie: dmCookie() };

  await api(`/api/players/${playerA}/profile`, {
    method: "PUT",
    headers: dmHeaders,
    body: { characterName: "A" }
  });

  const tokenB = createSession(playerB);
  const res = await api(`/api/players/${playerA}/profile`, {
    method: "GET",
    headers: { "x-player-token": tokenB }
  });
  assert.equal(res.res.status, 403);
  assert.equal(res.data.error, "forbidden");
});
