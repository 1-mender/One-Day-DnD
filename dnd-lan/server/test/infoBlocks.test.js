import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-info-blocks-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "test_secret";
process.env.DM_COOKIE = "dm_token_test";

const { getDb, initDb, getSinglePartyId } = await import("../src/db.js");
const { signDmToken, createDmUser } = await import("../src/auth.js");
const { infoBlocksRouter } = await import("../src/routes/infoBlocks.js");
const { now } = await import("../src/util.js");

initDb();
const dmUser = createDmUser("dm", "secret123");

const app = express();
app.locals.io = { to() { return { emit() {} }; } };
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use("/api/info-blocks", infoBlocksRouter);

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
  const partyId = getSinglePartyId();
  const t = now();
  return Number(
    db.prepare(
      "INSERT INTO players(party_id, display_name, status, last_seen, banned, created_at) VALUES(?,?,?,?,?,?)"
    ).run(partyId, displayName, "offline", t, 0, t).lastInsertRowid
  );
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

test("selected access requires at least one chosen player on create and update", async () => {
  const playerId = createPlayer("Visible Hero");
  const headers = { cookie: dmCookie() };

  const createFail = await api("/api/info-blocks", {
    method: "POST",
    headers,
    body: {
      title: "Hook clue",
      content: "Only some players should see this",
      access: "selected",
      selectedPlayerIds: []
    }
  });
  assert.equal(createFail.res.status, 400);
  assert.equal(createFail.data.error, "selected_players_required");

  const createOk = await api("/api/info-blocks", {
    method: "POST",
    headers,
    body: {
      title: "Hook clue",
      content: "Only some players should see this",
      access: "selected",
      selectedPlayerIds: [playerId]
    }
  });
  assert.equal(createOk.res.status, 200);
  assert.ok(createOk.data.id);

  const updateFail = await api(`/api/info-blocks/${createOk.data.id}`, {
    method: "PUT",
    headers,
    body: {
      title: "Hook clue",
      content: "Still selected",
      access: "selected",
      selectedPlayerIds: []
    }
  });
  assert.equal(updateFail.res.status, 400);
  assert.equal(updateFail.data.error, "selected_players_required");
});
