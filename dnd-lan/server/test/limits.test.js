import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-limits-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.PLAYER_NAME_MAX_LEN = "3";
process.env.JOIN_CODE_MAX_LEN = "3";

const { initDb } = await import("../src/db.js");
const { partyRouter } = await import("../src/routes/party.js");

initDb();

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use("/api/party", partyRouter);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
});

async function api(body) {
  const res = await fetch(`${base}/api/party/join-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

test("join-request rejects long displayName", async () => {
  const out = await api({ displayName: "abcd" });
  assert.equal(out.res.status, 400);
  assert.equal(out.data.error, "name_too_long");
});

test("join-request rejects long joinCode", async () => {
  const out = await api({ displayName: "ok", joinCode: "abcd" });
  assert.equal(out.res.status, 400);
  assert.equal(out.data.error, "join_code_too_long");
});

test("join-request accepts valid input", async () => {
  const out = await api({ displayName: "ok", joinCode: "ok" });
  assert.equal(out.res.status, 200);
  assert.equal(out.data.ok, true);
});
