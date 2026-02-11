import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-write-gate-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "test_secret";
process.env.DM_COOKIE = "dm_token_test";

const { initDb } = await import("../src/db.js");
const { signDmToken } = await import("../src/auth.js");
const { setDegraded, clearDegraded } = await import("../src/degraded.js");
const { assertWritable } = await import("../src/writeGate.js");
const { backupRouter } = await import("../src/routes/backup.js");

initDb();

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(assertWritable);
app.post("/api/party/write-probe", (_req, res) => res.json({ ok: true }));
app.use("/api/backup", backupRouter);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

function dmCookie() {
  const token = signDmToken({ id: 1, username: "dm" });
  return `${process.env.DM_COOKIE}=${token}`;
}

test.after(() => {
  clearDegraded();
  server.close();
});

test("write gate blocks non-whitelisted writes when degraded", async () => {
  setDegraded("not_ready");
  try {
    const res = await fetch(`${base}/api/party/write-probe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    const data = await res.json().catch(() => ({}));
    assert.equal(res.status, 503);
    assert.equal(res.headers.get("retry-after"), "60");
    assert.equal(data.error, "read_only");
  } finally {
    clearDegraded();
  }
});

test("write gate allows backup import endpoint when degraded", async () => {
  setDegraded("not_ready");
  try {
    const res = await fetch(`${base}/api/backup/import`, {
      method: "POST",
      headers: { cookie: dmCookie() }
    });
    const data = await res.json().catch(() => ({}));
    assert.notEqual(res.status, 503);
    assert.equal(data.error, "file_required");
  } finally {
    clearDegraded();
  }
});
