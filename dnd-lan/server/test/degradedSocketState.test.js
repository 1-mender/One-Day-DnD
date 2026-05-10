import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import express from "express";
import { io as clientIo } from "socket.io-client";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-degraded-socket-"));
process.env.DND_LAN_DATA_DIR = tmpDir;

const { initDb, closeDb } = await import("../src/db.js");
const { createSocketServer } = await import("../src/sockets.js");
const { setDegraded, clearDegraded } = await import("../src/degraded.js");

function waitSocketEvent(socket, eventName, timeoutMs = 1500) {
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

test.before(() => {
  initDb();
  clearDegraded();
});

test.after(() => {
  clearDegraded();
  closeDb();
});

test("socket receives healthy degraded snapshot on connect", async (t) => {
  clearDegraded();
  const { server, ioServer, baseUrl } = await startServer();
  const socket = clientIo(baseUrl, { autoConnect: false, reconnection: false });

  t.after(async () => {
    if (socket.connected) socket.disconnect();
    await stopServer(server, ioServer);
  });

  const statePromise = waitSocketEvent(socket, "system:degraded");
  socket.connect();
  const state = await statePromise;

  assert.equal(state?.ok, true);
});

test("socket receives read-only degraded snapshot on connect", async (t) => {
  setDegraded("not_ready");
  const { server, ioServer, baseUrl } = await startServer();
  const socket = clientIo(baseUrl, { autoConnect: false, reconnection: false });

  t.after(async () => {
    if (socket.connected) socket.disconnect();
    await stopServer(server, ioServer);
    clearDegraded();
  });

  const statePromise = waitSocketEvent(socket, "system:degraded");
  socket.connect();
  const state = await statePromise;

  assert.equal(state?.ok, false);
  assert.equal(state?.reason, "not_ready");
});
