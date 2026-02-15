import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-dm-validation-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "test_secret";
process.env.DM_COOKIE = "dm_token_test";

const { initDb } = await import("../src/db.js");
const { signDmToken, createDmUser } = await import("../src/auth.js");
const { inventoryRouter } = await import("../src/routes/inventory.js");
const { ticketsRouter } = await import("../src/routes/tickets.js");

initDb();
const dmUser = createDmUser("dm", "secret123");

const app = express();
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use("/api/inventory", inventoryRouter);
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

function orphanDmCookie() {
  const token = signDmToken({ id: 999999, username: "orphan", token_version: 0 });
  return `${process.env.DM_COOKIE}=${token}`;
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

test("DM inventory add returns 404 for unknown player", async () => {
  const out = await api("/api/inventory/dm/player/999999", {
    method: "POST",
    body: { name: "Potion", qty: 1 }
  });
  assert.equal(out.res.status, 404);
  assert.equal(out.data.error, "player_not_found");
});

test("DM tickets adjust returns 404 for unknown player", async () => {
  const out = await api("/api/tickets/dm/adjust", {
    method: "POST",
    body: { playerId: 999999, delta: 5, reason: "test" }
  });
  assert.equal(out.res.status, 404);
  assert.equal(out.data.error, "player_not_found");
});

test("orphan DM token is rejected", async () => {
  const res = await fetch(`${base}/api/tickets/dm/adjust`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: orphanDmCookie()
    },
    body: JSON.stringify({ playerId: 1, delta: 1 })
  });
  const data = await res.json().catch(() => ({}));
  assert.equal(res.status, 401);
  assert.equal(data.error, "not_authenticated");
});
