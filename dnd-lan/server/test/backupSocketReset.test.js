import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { io as clientIo } from "socket.io-client";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-backup-socket-reset-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "test_secret";
process.env.DM_COOKIE = "dm_token_test";

const { closeDb, getDb, getSinglePartyId, initDb } = await import("../src/db.js");
const { createDmUser, signDmToken } = await import("../src/auth.js");
const { backupRouter } = await import("../src/routes/backup.js");
const { createSocketServer } = await import("../src/sockets.js");
const { now } = await import("../src/util.js");

initDb();
const dmUser = createDmUser("dm", "secret123");

const app = express();
app.use(cookieParser());
app.use("/api/backup", backupRouter);

const server = http.createServer(app);
const ioServer = createSocketServer(server);
app.locals.io = ioServer;

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

test.after(async () => {
  ioServer.close();
  await new Promise((resolve) => server.close(resolve));
  closeDb();
});

function dmCookie() {
  return `${process.env.DM_COOKIE}=${signDmToken(dmUser)}`;
}

function createPlayerSession() {
  const db = getDb();
  const partyId = getSinglePartyId();
  const t = now();
  const playerId = Number(
    db.prepare("INSERT INTO players(party_id, display_name, status, last_seen, banned, created_at) VALUES(?,?,?,?,?,?)")
      .run(partyId, "Socket Import", "offline", t, 0, t).lastInsertRowid
  );
  const token = `sock_${playerId}_${t}`;
  db.prepare(
    "INSERT INTO sessions(token, player_id, party_id, created_at, expires_at, revoked, impersonated, impersonated_write) VALUES(?,?,?,?,?,?,?,?)"
  ).run(token, playerId, partyId, t, t + 60_000, 0, 0, 0);
  return token;
}

function waitForEvent(socket, eventName, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`${eventName}_timeout`));
    }, timeoutMs);
    function onEvent(...args) {
      clearTimeout(timer);
      resolve(args);
    }
    socket.once(eventName, onEvent);
  });
}

test("backup import disconnects active sockets and emits session invalidation", async () => {
  const token = createPlayerSession();
  const socket = clientIo(base, {
    auth: { playerToken: token },
    forceNew: true,
    reconnection: false,
    transports: ["websocket"]
  });

  try {
    await waitForEvent(socket, "connect");

    const sessionInvalidWait = waitForEvent(socket, "player:sessionInvalid");
    const disconnectWait = waitForEvent(socket, "disconnect");

    const exportRes = await fetch(`${base}/api/backup/export`, {
      headers: { cookie: dmCookie() }
    });
    assert.equal(exportRes.status, 200);
    const backupZip = new Uint8Array(await exportRes.arrayBuffer());

    const form = new FormData();
    form.append("zip", new Blob([backupZip], { type: "application/zip" }), "backup.zip");
    const importRes = await fetch(`${base}/api/backup/import`, {
      method: "POST",
      headers: { cookie: dmCookie() },
      body: form
    });
    const importData = await importRes.json().catch(() => ({}));
    assert.equal(importRes.status, 200);
    assert.equal(importData.ok, true);

    await Promise.all([sessionInvalidWait, disconnectWait]);
    assert.equal(socket.connected, false);
  } finally {
    socket.disconnect();
  }
});
