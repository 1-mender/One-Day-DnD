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

const { getDb, initDb, getSinglePartyId } = await import("../src/db.js");
const { signDmToken, createDmUser } = await import("../src/auth.js");
const { profileRouter } = await import("../src/routes/profile.js");
const { playersRouter } = await import("../src/routes/players.js");
const { now } = await import("../src/util.js");

initDb();
const dmUser = createDmUser("dm", "secret123");

const app = express();
const ioEvents = [];
app.locals.io = {
  to(room) {
    return {
      emit(event, payload) {
        ioEvents.push({ room, event, payload });
      }
    };
  }
};
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use("/api", profileRouter);
app.use("/api/players", playersRouter);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
});

test.beforeEach(() => {
  ioEvents.length = 0;
});

function dmCookie() {
  const token = signDmToken(dmUser);
  return `${process.env.DM_COOKIE}=${token}`;
}

function createPlayer(displayName = "Player One") {
  const db = getDb();
  const partyId = getSinglePartyId();
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
  ).run(token, playerId, getSinglePartyId(), t, expiresAt, 0, impersonated, impersonatedWrite);
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
      publicFields: ["classRole", "level", "race", "publicBlurb"],
      publicBlurb: "Scout and lockpicker",
      editableFields: ["bio"],
      allowRequests: true
    }
  });

  assert.equal(createRes.res.status, 200);
  assert.equal(createRes.data.profile.characterName, "Alice");
  assert.deepEqual(createRes.data.profile.publicFields, ["classRole", "level", "race", "publicBlurb"]);
  assert.equal(createRes.data.profile.publicBlurb, "Scout and lockpicker");

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

test("DM can award class XP with visible log", async () => {
  const playerId = createPlayer("XP Player");
  const dmHeaders = { cookie: dmCookie() };
  const token = createSession(playerId);

  await api(`/api/players/${playerId}/profile`, {
    method: "PUT",
    headers: dmHeaders,
    body: { characterName: "Learner", classKey: "warrior", xp: 90 }
  });

  const awardRes = await api(`/api/players/${playerId}/profile/xp`, {
    method: "POST",
    headers: dmHeaders,
    body: { amount: 15, reason: "Квест" }
  });
  assert.equal(awardRes.res.status, 200);
  assert.equal(awardRes.data.profile.xp, 105);
  assert.equal(awardRes.data.profile.xpLog[0].amount, 15);
  assert.equal(awardRes.data.profile.xpLog[0].reason, "Квест");

  const playerRes = await api(`/api/players/${playerId}/profile`, {
    headers: { "x-player-token": token }
  });
  assert.equal(playerRes.res.status, 200);
  assert.equal(playerRes.data.profile.xp, 105);
  assert.equal(playerRes.data.profile.xpLog[0].reason, "Квест");
  assert.ok(ioEvents.find((entry) => entry.room === `player:${playerId}` && entry.event === "profile:updated"));
});

test("DM players list marks profiles ready for specialization", async () => {
  const playerId = createPlayer("Ready Player");
  const dmHeaders = { cookie: dmCookie() };

  await api(`/api/players/${playerId}/profile`, {
    method: "PUT",
    headers: dmHeaders,
    body: { characterName: "Ready", classKey: "warrior", xp: 100 }
  });

  const listRes = await api("/api/players/dm/list", { headers: dmHeaders });
  assert.equal(listRes.res.status, 200);

  const player = listRes.data.items.find((item) => item.id === playerId);
  assert.equal(player.profileExists, true);
  assert.equal(player.specializationAvailable, true);
});

test("DM players list exposes character search fields and pending request count", async () => {
  const playerId = createPlayer("Searchable Player");
  const token = createSession(playerId);
  const dmHeaders = { cookie: dmCookie() };

  await api(`/api/players/${playerId}/profile`, {
    method: "PUT",
    headers: dmHeaders,
    body: { characterName: "Selena", classRole: "Арканист", allowRequests: true }
  });

  const reqRes = await api(`/api/players/${playerId}/profile-requests`, {
    method: "POST",
    headers: { "x-player-token": token },
    body: { proposedChanges: { bio: "Хочу обновить биографию" }, reason: "Новая сцена" }
  });
  assert.equal(reqRes.res.status, 200);

  const listRes = await api("/api/players/dm/list", { headers: dmHeaders });
  assert.equal(listRes.res.status, 200);

  const player = listRes.data.items.find((item) => item.id === playerId);
  assert.equal(player.characterName, "Selena");
  assert.equal(player.classRole, "Арканист");
  assert.equal(player.pendingRequestCount, 1);
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
  assert.ok(ioEvents.find((entry) => entry.room === `player:${playerId}` && entry.event === "profile:updated"));
  assert.ok(ioEvents.find((entry) => entry.room === `player:${playerId}` && entry.event === "profile:requestsUpdated"));
});

test("DM reject emits live profile request update to player room", async () => {
  const playerId = createPlayer("Player Reject");
  const token = createSession(playerId);
  const dmHeaders = { cookie: dmCookie() };

  await api(`/api/players/${playerId}/profile`, {
    method: "PUT",
    headers: dmHeaders,
    body: { characterName: "Reject Me", allowRequests: true }
  });

  const reqRes = await api(`/api/players/${playerId}/profile-requests`, {
    method: "POST",
    headers: { "x-player-token": token },
    body: {
      proposedChanges: { bio: "Need update" },
      reason: "Arc update"
    }
  });
  assert.equal(reqRes.res.status, 200);

  const rejectRes = await api(`/api/profile-requests/${reqRes.data.requestId}/reject`, {
    method: "POST",
    headers: dmHeaders,
    body: { note: "Not now" }
  });
  assert.equal(rejectRes.res.status, 200);
  assert.ok(ioEvents.find((entry) =>
    entry.room === `player:${playerId}`
    && entry.event === "profile:requestsUpdated"
    && entry.payload?.status === "rejected"
  ));
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

test("DM profile update returns 404 for unknown player", async () => {
  const dmHeaders = { cookie: dmCookie() };

  const res = await api("/api/players/999999/profile", {
    method: "PUT",
    headers: dmHeaders,
    body: { characterName: "Ghost" }
  });

  assert.equal(res.res.status, 404);
  assert.equal(res.data.error, "player_not_found");
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

test("Other player can read only public profile projection", async () => {
  const playerA = createPlayer("Public A");
  const playerB = createPlayer("Public B");
  const dmHeaders = { cookie: dmCookie() };

  await api(`/api/players/${playerA}/profile`, {
    method: "PUT",
    headers: dmHeaders,
    body: {
      characterName: "Aria",
      classRole: "Ranger",
      level: 4,
      stats: { race: "elf", str: 10 },
      bio: "Private notes",
      avatarUrl: "/uploads/aria.png",
      publicFields: ["classRole", "level", "race", "publicBlurb"],
      publicBlurb: "Следопыт с севера"
    }
  });

  const tokenB = createSession(playerB);
  const res = await api(`/api/players/${playerA}/public-profile`, {
    method: "GET",
    headers: { "x-player-token": tokenB }
  });
  assert.equal(res.res.status, 200);
  assert.deepEqual(res.data.profile, {
    characterName: "Aria",
    avatarUrl: "/uploads/aria.png",
    classRole: "Ranger",
    level: 4,
    race: "Городской эльф",
    raceKey: "elf",
    raceVariantKey: "city",
    raceTrait: "Дипломатия улиц",
    publicBlurb: "Следопыт с севера"
  });
});

test("Roster returns public profile projection without private fields", async () => {
  const playerA = createPlayer("Roster A");
  const playerB = createPlayer("Roster B");
  const dmHeaders = { cookie: dmCookie() };

  await api(`/api/players/${playerA}/profile`, {
    method: "PUT",
    headers: dmHeaders,
    body: {
      characterName: "Aria",
      classRole: "Ranger",
      level: 4,
      stats: { race: "elf", str: 18 },
      bio: "Private backstory",
      publicFields: ["classRole", "race"],
      publicBlurb: "Should stay hidden"
    }
  });

  const tokenB = createSession(playerB);
  const res = await api("/api/players", {
    method: "GET",
    headers: { "x-player-token": tokenB }
  });
  assert.equal(res.res.status, 200);

  const item = res.data.items.find((entry) => entry.id === playerA);
  assert.deepEqual(item.publicProfile, {
    characterName: "Aria",
    classRole: "Ranger",
    race: "Городской эльф",
    raceKey: "elf",
    raceVariantKey: "city",
    raceTrait: "Дипломатия улиц"
  });
  assert.equal("bio" in item.publicProfile, false);
  assert.equal("stats" in item.publicProfile, false);
  assert.equal("publicBlurb" in item.publicProfile, false);
});

test("Profile save normalizes race variant for selected race", async () => {
  const playerId = createPlayer("Race Normalize");
  const dmHeaders = { cookie: dmCookie() };

  const res = await api(`/api/players/${playerId}/profile`, {
    method: "PUT",
    headers: dmHeaders,
    body: {
      characterName: "Origin",
      stats: { race: "human", raceVariant: "high", str: 11 }
    }
  });

  assert.equal(res.res.status, 200);
  assert.deepEqual(res.data.profile.stats, {
    race: "human",
    raceVariant: "city",
    str: 11
  });
});

test("Approve request keeps existing race variant when stats patch omits race fields", async () => {
  const playerId = createPlayer("Race Request");
  const token = createSession(playerId);
  const dmHeaders = { cookie: dmCookie() };

  await api(`/api/players/${playerId}/profile`, {
    method: "PUT",
    headers: dmHeaders,
    body: {
      characterName: "Keeper",
      allowRequests: true,
      stats: { race: "elf", raceVariant: "high", dex: 14 }
    }
  });

  const reqRes = await api(`/api/players/${playerId}/profile-requests`, {
    method: "POST",
    headers: { "x-player-token": token },
    body: {
      proposedChanges: { stats: { str: 12 } },
      reason: "Need more strength"
    }
  });
  assert.equal(reqRes.res.status, 200);

  const approveRes = await api(`/api/profile-requests/${reqRes.data.requestId}/approve`, {
    method: "POST",
    headers: dmHeaders,
    body: { note: "OK" }
  });
  assert.equal(approveRes.res.status, 200);

  const profileRes = await api(`/api/players/${playerId}/profile`, {
    method: "GET",
    headers: dmHeaders
  });
  assert.equal(profileRes.res.status, 200);
  assert.deepEqual(profileRes.data.profile.stats, {
    race: "elf",
    raceVariant: "high",
    str: 12
  });
});
