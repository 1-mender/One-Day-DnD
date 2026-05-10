import test from "node:test";
import assert from "node:assert";
import { createApp } from "../src/bootstrap/app.js";
import { initDb, closeDb, getDb } from "../src/db.js";
import http from "node:http";

let app;
let server;
let baseUrl;

test.before(async () => {
  initDb();
  app = createApp();
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const addr = server.address();
  baseUrl = `http://${addr.address}:${addr.port}`;
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
});

test("POST без CSRF token должен быть отклонён", async (t) => {
  const res = await fetch(`${baseUrl}/api/inventory/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId: 1 }),
    credentials: "include"
  });
  
  assert.strictEqual(res.status, 403);
  const data = await res.json();
  assert.ok(data.error.includes("csrf"), "Должна быть CSRF ошибка");
});

test("POST с правильным CSRF token должен быть принят (не 403 csrf)", async (t) => {
  // 1. Получить CSRF token
  const tokenRes = await fetch(`${baseUrl}/api/csrf-token`);
  const tokenData = await tokenRes.json();
  const csrfToken = tokenData.csrfToken;
  assert.ok(csrfToken, "CSRF token должен быть получен");
  
  // 2. Попытаться POST с token'ом
  const res = await fetch(`${baseUrl}/api/inventory/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken
    },
    body: JSON.stringify({ itemId: 1 }),
    credentials: "include"
  });
  
  // Не должно быть 403 CSRF ошибки
  if (res.status === 403) {
    const data = await res.json();
    assert.ok(!data.error.includes("csrf"), `Не должно быть CSRF ошибки, получена: ${data.error}`);
  }
});

test("POST с неправильным CSRF token должен быть отклонён", async (t) => {
  const res = await fetch(`${baseUrl}/api/inventory/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "invalid-csrf-token-12345"
    },
    body: JSON.stringify({ itemId: 1 }),
    credentials: "include"
  });
  
  assert.strictEqual(res.status, 403);
  const data = await res.json();
  assert.ok(data.error.includes("csrf"), "Должна быть CSRF ошибка");
});

test("GET routes НЕ требуют CSRF token", async (t) => {
  const res = await fetch(`${baseUrl}/api/inventory/list`, {
    method: "GET"
  });
  
  // Может быть 200, 404, или другие ошибки, но НЕ 403 CSRF
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
