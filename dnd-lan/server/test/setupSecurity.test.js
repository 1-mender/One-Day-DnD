import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-setup-security-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "test_secret";
process.env.DM_SETUP_TRUSTED_IPS = "";

const { initDb, getDb } = await import("../src/db.js");
const { setupRouter } = await import("../src/routes/setup.js");

initDb();

const app = express();
app.set("trust proxy", true);
app.use(express.json());
app.use("/api/dm", setupRouter);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
});

async function setupRequest(payload, headers = {}) {
  const res = await fetch(`${base}/api/dm/setup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify(payload || {})
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

test("setup hardening: local-only fallback + secret gate", async () => {
  process.env.DM_SETUP_SECRET = "";
  const blocked = await setupRequest(
    { username: "dm", password: "secret123" },
    { "x-forwarded-for": "192.168.10.10" }
  );
  assert.equal(blocked.res.status, 403);
  assert.equal(blocked.data.error, "setup_local_only");

  process.env.DM_SETUP_SECRET = "setup-secret";
  const missingSecret = await setupRequest(
    { username: "dm", password: "secret123" },
    { "x-forwarded-for": "192.168.10.10" }
  );
  assert.equal(missingSecret.res.status, 403);
  assert.equal(missingSecret.data.error, "setup_secret_required");

  const ok = await setupRequest(
    { username: "dm", password: "secret123", setupSecret: "setup-secret" },
    { "x-forwarded-for": "192.168.10.10" }
  );
  assert.equal(ok.res.status, 200);
  assert.equal(ok.data.ok, true);

  const users = getDb().prepare("SELECT COUNT(*) AS c FROM users").get()?.c || 0;
  assert.equal(users, 1);

  const second = await setupRequest(
    { username: "dm2", password: "secret123", setupSecret: "setup-secret" },
    { "x-forwarded-for": "192.168.10.10" }
  );
  assert.equal(second.res.status, 409);
  assert.equal(second.data.error, "already_setup");
});
