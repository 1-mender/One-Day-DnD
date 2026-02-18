import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-events-security-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "test_secret";
process.env.DM_COOKIE = "dm_token_test";

const { initDb, getDb, getPartyId } = await import("../src/db.js");
const { createDmUser, signDmToken } = await import("../src/auth.js");
const { eventsRouter } = await import("../src/routes/events.js");
const { now } = await import("../src/util.js");

initDb();
const dmUser = createDmUser("dm", "secret123");

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use("/api/events", eventsRouter);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
});

function dmCookie() {
  return `${process.env.DM_COOKIE}=${signDmToken(dmUser)}`;
}

function seedEvents(count = 2) {
  const db = getDb();
  const partyId = getPartyId();
  const t = now();
  for (let i = 0; i < count; i += 1) {
    db.prepare(
      "INSERT INTO events(party_id, type, actor_role, actor_player_id, actor_name, target_type, target_id, message, data, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)"
    ).run(partyId, "test.event", "dm", null, "DM", "test", i + 1, `ev-${i + 1}`, "{}", t + i);
  }
}

async function cleanup(payload) {
  const res = await fetch(`${base}/api/events/cleanup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: dmCookie()
    },
    body: JSON.stringify(payload || {})
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

test("events cleanup all requires explicit confirm=DELETE", async () => {
  seedEvents(2);

  const withoutConfirm = await cleanup({ mode: "all" });
  assert.equal(withoutConfirm.res.status, 400);
  assert.equal(withoutConfirm.data.error, "confirm_required");
  const stillThere = getDb().prepare("SELECT COUNT(*) AS c FROM events").get()?.c || 0;
  assert.equal(stillThere, 2);

  const wrongConfirm = await cleanup({ mode: "all", confirm: "delete" });
  assert.equal(wrongConfirm.res.status, 400);
  assert.equal(wrongConfirm.data.error, "confirm_required");
  const stillThere2 = getDb().prepare("SELECT COUNT(*) AS c FROM events").get()?.c || 0;
  assert.equal(stillThere2, 2);

  const ok = await cleanup({ mode: "all", confirm: "DELETE" });
  assert.equal(ok.res.status, 200);
  assert.equal(ok.data.ok, true);
  assert.equal(ok.data.deleted, 2);
});
