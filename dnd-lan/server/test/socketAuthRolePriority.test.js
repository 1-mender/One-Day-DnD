import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import express from "express";
import { io as clientIo } from "socket.io-client";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-socket-auth-role-"));
process.env.DND_LAN_DATA_DIR = tmpDir;

const { initDb, getDb, getSinglePartyId, closeDb } = await import("../src/db.js");
const { createSocketServer } = await import("../src/sockets.js");
const { createDmUser, signDmToken, getDmCookieName } = await import("../src/auth.js");
const { getPlayerCookieName } = await import("../src/sessionAuth.js");

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

function emitWithAck(socket, eventName, payload, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`timeout waiting for ack: ${eventName}`));
    }, timeoutMs);
    socket.emit(eventName, payload, (res) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const ioServer = createSocketServer(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { server, ioServer, baseUrl };
}

async function stopServer(server, ioServer) {
  ioServer.close();
  await new Promise((resolve) => server.close(resolve));
}

function createDmToken() {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const user = createDmUser(`dm_${suffix}`, "password123");
  return signDmToken(user);
}

function createPlayerSession() {
  const db = getDb();
  const partyId = getSinglePartyId();
  const t = Date.now();
  const playerId = db.prepare(
    "INSERT INTO players(party_id, display_name, status, last_seen, banned, created_at) VALUES(?,?,?,?,?,?)"
  ).run(partyId, `P_${t}`, "offline", t, 0, t).lastInsertRowid;
  const token = `tok_${t}_${playerId}`;
  db.prepare(
    "INSERT INTO sessions(token, player_id, party_id, created_at, expires_at, revoked, impersonated, impersonated_write) VALUES(?,?,?,?,?,?,?,?)"
  ).run(token, playerId, partyId, t, t + 60_000, 0, 0, 0);
  return { token };
}

function createJoinRequest(joinRequestId = "jr_test_1") {
  const db = getDb();
  const partyId = getSinglePartyId();
  const t = Date.now();
  db.prepare(
    "INSERT INTO join_requests(id, party_id, display_name, ip, user_agent, created_at) VALUES(?,?,?,?,?,?)"
  ).run(joinRequestId, partyId, `Join-${joinRequestId}`, "127.0.0.1", "test", t);
  return joinRequestId;
}

test.before(() => {
  initDb();
});

test.after(() => {
  closeDb();
});

test("waiting role takes precedence over DM cookie", async (t) => {
  const dmToken = createDmToken();
  const joinRequestId = createJoinRequest("jr_test_1");
  const { server, ioServer, baseUrl } = await startServer();

  const socket = clientIo(baseUrl, {
    autoConnect: false,
    reconnection: false,
    auth: { role: "waiting", joinRequestId },
    extraHeaders: {
      Cookie: `${getDmCookieName()}=${dmToken}`
    }
  });

  t.after(async () => {
    if (socket.connected) socket.disconnect();
    await stopServer(server, ioServer);
  });

  let dmConnected = false;
  socket.on("dm:connected", () => {
    dmConnected = true;
  });

  const waitingPromise = waitForEvent(socket, "join:waiting");
  socket.connect();
  const payload = await waitingPromise;
  await sleep(30);

  assert.equal(payload?.joinRequestId, joinRequestId);
  assert.equal(dmConnected, false);
});

test("waiting socket with stale joinRequestId is rejected immediately", async (t) => {
  const { server, ioServer, baseUrl } = await startServer();
  const socket = clientIo(baseUrl, {
    autoConnect: false,
    reconnection: false,
    auth: { role: "waiting", joinRequestId: "jr_missing" }
  });

  t.after(async () => {
    if (socket.connected) socket.disconnect();
    await stopServer(server, ioServer);
  });

  const rejectedPromise = waitForEvent(socket, "player:rejected");
  socket.connect();
  const payload = await rejectedPromise;

  assert.equal(payload?.joinRequestId, "jr_missing");
  assert.equal(payload?.stale, true);
});

test("player role takes precedence over DM cookie", async (t) => {
  const dmToken = createDmToken();
  const { token: playerToken } = createPlayerSession();
  const { server, ioServer, baseUrl } = await startServer();

  const socket = clientIo(baseUrl, {
    autoConnect: false,
    reconnection: false,
    auth: { role: "player" },
    extraHeaders: {
      Cookie: `${getDmCookieName()}=${dmToken}; ${getPlayerCookieName()}=${playerToken}`
    }
  });

  t.after(async () => {
    if (socket.connected) socket.disconnect();
    await stopServer(server, ioServer);
  });

  let dmConnected = false;
  socket.on("dm:connected", () => {
    dmConnected = true;
  });

  const connectPromise = waitForEvent(socket, "connect");
  socket.connect();
  await connectPromise;

  const ack = await emitWithAck(socket, "auth:swap", { playerToken });
  assert.equal(ack?.ok, true);
  assert.equal(dmConnected, false);
});
