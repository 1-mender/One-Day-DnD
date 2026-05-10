import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { io as clientIo } from "socket.io-client";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-runtime-metrics-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "runtime_metrics_test_secret";
process.env.DM_COOKIE = "dm_token_metrics_test";

const { initDb, getDb, getSinglePartyId, closeDb } = await import("../src/db.js");
const { createApp, finalizeApp } = await import("../src/bootstrap/app.js");
const { createSocketServer } = await import("../src/sockets.js");
const { createDmUser, signDmToken } = await import("../src/auth.js");
const { resetRuntimeMetricsForTests } = await import("../src/runtimeMetrics.js");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForEvent(socket, eventName, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`timeout waiting for ${eventName}`));
    }, timeoutMs);
    const onEvent = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(eventName, onEvent);
  });
}

async function startServer() {
  const app = finalizeApp(createApp());
  const server = http.createServer(app);
  const ioServer = createSocketServer(server);
  app.locals.io = ioServer;
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    server,
    ioServer,
    baseUrl: `http://127.0.0.1:${server.address().port}`
  };
}

async function stopServer(server, ioServer) {
  ioServer.close();
  await new Promise((resolve) => server.close(resolve));
}

async function waitForMetrics(baseUrl, cookie, predicate, timeoutMs = 1500) {
  const deadline = Date.now() + timeoutMs;
  let lastMetrics = null;
  while (Date.now() < deadline) {
    const res = await fetch(`${baseUrl}/api/server/metrics`, {
      headers: { cookie }
    });
    lastMetrics = await res.json().catch(() => ({}));
    if (res.ok && predicate(lastMetrics)) {
      return { res, metrics: lastMetrics };
    }
    await sleep(30);
  }
  return { res: null, metrics: lastMetrics };
}

function dmCookie() {
  const user = createDmUser(`dm_${Date.now()}_${Math.random().toString(36).slice(2)}`, "secret123");
  return `${process.env.DM_COOKIE}=${signDmToken(user)}`;
}

function createPlayerSession() {
  const db = getDb();
  const partyId = getSinglePartyId();
  const t = Date.now();
  const playerId = Number(db.prepare(
    "INSERT INTO players(party_id, display_name, status, last_seen, banned, created_at) VALUES(?,?,?,?,?,?)"
  ).run(partyId, `Metrics P ${t}`, "offline", t, 0, t).lastInsertRowid);
  const token = `metrics_${t}_${playerId}`;
  db.prepare(
    "INSERT INTO sessions(token, player_id, party_id, created_at, expires_at, revoked, impersonated, impersonated_write) VALUES(?,?,?,?,?,?,?,?)"
  ).run(token, playerId, partyId, t, t + 60_000, 0, 0, 0);
  return token;
}

test.before(() => {
  initDb();
});

test.after(() => {
  closeDb();
});

test("metrics endpoint is DM-only and exposes HTTP/socket counters", async (t) => {
  resetRuntimeMetricsForTests();
  const { server, ioServer, baseUrl } = await startServer();
  const cookie = dmCookie();
  const playerToken = createPlayerSession();
  const staleSocket = clientIo(baseUrl, {
    autoConnect: false,
    reconnection: false,
    auth: { role: "waiting", joinRequestId: "missing_jr_metrics" }
  });
  const playerSocket = clientIo(baseUrl, {
    autoConnect: false,
    reconnection: false,
    auth: { role: "player", playerToken }
  });

  t.after(async () => {
    if (staleSocket.connected) staleSocket.disconnect();
    if (playerSocket.connected) playerSocket.disconnect();
    await stopServer(server, ioServer);
  });

  const anonRes = await fetch(`${baseUrl}/api/server/metrics`);
  const anonData = await anonRes.json().catch(() => ({}));
  assert.equal(anonRes.status, 401);
  assert.equal(anonData.error, "not_authenticated");

  const infoRes = await fetch(`${baseUrl}/api/server/info`);
  assert.equal(infoRes.status, 200);

  const rejectedPromise = waitForEvent(staleSocket, "player:rejected");
  staleSocket.connect();
  const rejectedPayload = await rejectedPromise;
  assert.equal(rejectedPayload?.stale, true);

  const connectPromise = waitForEvent(playerSocket, "connect");
  playerSocket.connect();
  await connectPromise;
  await sleep(20);
  playerSocket.disconnect();
  await sleep(20);

  const { metrics } = await waitForMetrics(
    baseUrl,
    cookie,
    (snapshot) => Number(snapshot?.socket?.disconnectedTotal || 0) >= 2
  );

  assert.ok(metrics?.http?.total >= 2);
  assert.ok(metrics?.http?.statusBuckets?.["4xx"] >= 1);
  assert.ok(metrics?.http?.latencyMs?.sampleCount >= 1);
  assert.ok(metrics?.socket?.connectedTotal >= 2);
  assert.ok(metrics?.socket?.disconnectedTotal >= 2);
  assert.ok(metrics?.socket?.staleWaitingRejectedTotal >= 1);
  assert.ok(metrics?.socket?.active >= 0);
});
