import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { registerHealthRoutes, resetReadyzLogStateForTest } = await import("../src/health.js");
const { logger } = await import("../src/logger.js");

function createApp(getDb, uploadsDir) {
  const app = express();
  registerHealthRoutes(app, { getDb, uploadsDir });
  return app;
}

async function getJson(base, route) {
  const res = await fetch(`${base}${route}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

test.beforeEach(() => {
  resetReadyzLogStateForTest();
});

test("healthz returns ok with uptime", async () => {
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-health-"));
  const app = createApp(() => ({ prepare: () => ({ get: () => ({ ok: 1 }) }) }), uploadsDir);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const out = await getJson(base, "/healthz");
    assert.equal(out.res.status, 200);
    assert.equal(out.data.ok, true);
    assert.equal(typeof out.data.uptimeSec, "number");
  } finally {
    server.close();
  }
});

test("readyz returns ok when db and uploads are accessible", async () => {
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-ready-"));
  const app = createApp(() => ({ prepare: () => ({ get: () => ({ ok: 1 }) }) }), uploadsDir);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const out = await getJson(base, "/readyz");
    assert.equal(out.res.status, 200);
    assert.deepEqual(out.data, { ok: true });
  } finally {
    server.close();
  }
});

test("readyz returns 503 when db check fails", async () => {
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-ready-fail-"));
  const app = createApp(() => ({ prepare: () => ({ get: () => { throw new Error("db_down"); } }) }), uploadsDir);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const out = await getJson(base, "/readyz");
    assert.equal(out.res.status, 503);
    assert.equal(out.data.ok, false);
    assert.equal(out.data.error, "not_ready");
  } finally {
    server.close();
  }
});

test("readyz throttles repeated identical failure logs and resets after success", async () => {
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-ready-throttle-"));
  let shouldFail = true;
  const app = createApp(
    () => ({ prepare: () => ({ get: () => {
      if (shouldFail) throw new Error("db_down");
      return { ok: 1 };
    } }) }),
    uploadsDir
  );
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;

  const originalError = logger.error;
  const seen = [];
  logger.error = (...args) => {
    seen.push(args);
  };

  try {
    const first = await getJson(base, "/readyz");
    const second = await getJson(base, "/readyz");
    shouldFail = false;
    const ok = await getJson(base, "/readyz");
    shouldFail = true;
    const third = await getJson(base, "/readyz");

    assert.equal(first.res.status, 503);
    assert.equal(second.res.status, 503);
    assert.equal(ok.res.status, 200);
    assert.equal(third.res.status, 503);
    assert.equal(seen.length, 2);
  } finally {
    logger.error = originalError;
    server.close();
  }
});
