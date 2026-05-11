import test from "node:test";
import assert from "node:assert";
import { createApp } from "../src/bootstrap/app.js";
import { initDb, closeDb, getDb } from "../src/db.js";
import http from "node:http";

let app;
let server;
let baseUrl;

function readCookieHeader(res) {
  const raw = res.headers.get("set-cookie") || "";
  return raw.split(";")[0];
}

async function startServer() {
  app = createApp();
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const addr = server.address();
  baseUrl = `http://${addr.address}:${addr.port}`;
}

test.before(async () => {
  initDb();
  await startServer();
});

test.after(async () => {
  await new Promise((resolve) => {
    server.close(resolve);
  });
  closeDb();
});

test("GET /api/csrf-token должен вернуть CSRF token", async (t) => {
  const res = await fetch(`${baseUrl}/api/csrf-token`);
  assert.strictEqual(res.status, 200);

  const data = await res.json();
  assert.ok(data.csrfToken, "csrfToken должен быть в ответе");
  assert.strictEqual(typeof data.csrfToken, "string");
  assert.ok(data.csrfToken.length > 0, "csrfToken не должен быть пустым");
  assert.ok(readCookieHeader(res), "csrf cookie должен быть установлен");
});

test("POST без CSRF token должен быть отклонён", async (t) => {
  const res = await fetch(`${baseUrl}/api/party/join-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "No CSRF Player" })
  });

  assert.strictEqual(res.status, 403);
  const data = await res.json();
  assert.ok(data.error.includes("csrf"), "Должна быть CSRF ошибка");
});

test("POST с правильным CSRF token должен быть принят (не 403 csrf)", async (t) => {
  const tokenRes = await fetch(`${baseUrl}/api/csrf-token`);
  const tokenData = await tokenRes.json();
  const csrfToken = tokenData.csrfToken;
  const cookie = readCookieHeader(tokenRes);
  assert.ok(csrfToken, "CSRF token должен быть получен");

  const res = await fetch(`${baseUrl}/api/party/join-request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
      cookie
    },
    body: JSON.stringify({ displayName: `With CSRF ${Date.now()}` })
  });

  if (res.status === 403) {
    const data = await res.json();
    assert.ok(!data.error.includes("csrf"), `Не должно быть CSRF ошибки, получена: ${data.error}`);
    return;
  }
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
});

test("POST с неправильным CSRF token должен быть отклонён", async (t) => {
  const tokenRes = await fetch(`${baseUrl}/api/csrf-token`);
  const cookie = readCookieHeader(tokenRes);
  const res = await fetch(`${baseUrl}/api/party/join-request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "invalid-csrf-token-12345",
      cookie
    },
    body: JSON.stringify({ displayName: "Wrong CSRF" })
  });

  assert.strictEqual(res.status, 403);
  const data = await res.json();
  assert.ok(data.error.includes("csrf"), "Должна быть CSRF ошибка");
});

test("GET routes НЕ требуют CSRF token", async (t) => {
  const res = await fetch(`${baseUrl}/api/server/info`, {
    method: "GET"
  });

  assert.notStrictEqual(res.status, 403);
});

test("Auth routes NOT защищены CSRF (они используют другую авторизацию)", async (t) => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "test", password: "test" })
  });
  
  // Не должно быть 403 CSRF ошибки (auth route не защищён CSRF)
  if (res.status === 403) {
    const data = await res.json();
    assert.ok(!data.error.includes("csrf"), "Auth не должна требовать CSRF");
  }
});

test("CSRF token survives app restart because validation is cookie-based", async () => {
  const tokenRes = await fetch(`${baseUrl}/api/csrf-token`);
  const tokenData = await tokenRes.json();
  const csrfToken = tokenData.csrfToken;
  const cookie = readCookieHeader(tokenRes);

  await new Promise((resolve) => {
    server.close(resolve);
  });
  await startServer();

  const res = await fetch(`${baseUrl}/api/party/join-request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
      cookie
    },
    body: JSON.stringify({ displayName: `Restart CSRF ${Date.now()}` })
  });
  const data = await res.json().catch(() => ({}));

  assert.notStrictEqual(res.status, 403);
  assert.equal(res.status, 200);
  assert.equal(data.ok, true);
});
