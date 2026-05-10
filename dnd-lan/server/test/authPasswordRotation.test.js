import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-auth-rotation-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "test_secret";
process.env.DM_COOKIE = "dm_token_test";

const { initDb } = await import("../src/db.js");
const { createDmUser } = await import("../src/auth.js");
const { authRouter } = await import("../src/routes/auth.js");

initDb();
createDmUser("admin", "secret123");

const app = express();
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use("/api/auth", authRouter);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
});

function extractCookie(res) {
  const raw = res.headers.get("set-cookie") || "";
  return raw.split(";")[0] || "";
}

async function api(pathname, { method = "GET", body, cookie = "" } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

test("change-password rotates token_version and invalidates old cookie", async () => {
  const login = await api("/api/auth/login", {
    method: "POST",
    body: { username: "admin", password: "secret123" }
  });
  assert.equal(login.res.status, 200);
  const oldCookie = extractCookie(login.res);
  assert.ok(oldCookie.includes(process.env.DM_COOKIE));

  const meBefore = await api("/api/auth/me", { cookie: oldCookie });
  assert.equal(meBefore.res.status, 200);
  assert.equal(meBefore.data.authenticated, true);

  const changed = await api("/api/auth/change-password", {
    method: "POST",
    cookie: oldCookie,
    body: { newPassword: "newSecret456" }
  });
  assert.equal(changed.res.status, 200);
  assert.equal(changed.data.ok, true);
  const newCookie = extractCookie(changed.res);
  assert.ok(newCookie.includes(process.env.DM_COOKIE));
  assert.notEqual(newCookie, oldCookie);

  const meOld = await api("/api/auth/me", { cookie: oldCookie });
  assert.equal(meOld.res.status, 200);
  assert.equal(meOld.data.authenticated, false);

  const meNew = await api("/api/auth/me", { cookie: newCookie });
  assert.equal(meNew.res.status, 200);
  assert.equal(meNew.data.authenticated, true);

  const loginOldPwd = await api("/api/auth/login", {
    method: "POST",
    body: { username: "admin", password: "secret123" }
  });
  assert.equal(loginOldPwd.res.status, 401);

  const loginNewPwd = await api("/api/auth/login", {
    method: "POST",
    body: { username: "admin", password: "newSecret456" }
  });
  assert.equal(loginNewPwd.res.status, 200);
});
