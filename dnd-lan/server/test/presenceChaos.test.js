import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import express from "express";
import { io as clientIo } from "socket.io-client";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-presence-chaos-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.PRESENCE_GRACE_MS = "100";

const { initDb, getDb, getPartyId, closeDb } = await import("../src/db.js");
const { createSocketServer } = await import("../src/sockets.js");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPlayerWithSession(db, partyId) {
  const t = Date.now();
  const playerId = db
    .prepare("INSERT INTO players(party_id, display_name, status, last_seen, banned, created_at) VALUES(?,?,?,?,?,?)")
    .run(partyId, "Chaos", "offline", t, 0, t).lastInsertRowid;
  const token = `tok_${t}_${playerId}`;
  db
    .prepare(
      "INSERT INTO sessions(token, player_id, party_id, created_at, expires_at, revoked, impersonated, impersonated_write) VALUES(?,?,?,?,?,?,?,?)"
    )
    .run(token, playerId, partyId, t, t + 60_000, 0, 0, 0);
  return { playerId, token };
}

function waitForConnect(socket) {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve) => socket.once("connect", resolve));
}

test("presence chaos: reconnect loops and forced disconnect", async (t) => {
  initDb();
  const db = getDb();
  const partyId = getPartyId();
  const { playerId, token } = createPlayerWithSession(db, partyId);

  const app = express();
  const server = http.createServer(app);
  const ioServer = createSocketServer(server);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const s1 = clientIo(baseUrl, { auth: { playerToken: token } });
  const s2 = clientIo(baseUrl, { auth: { playerToken: token } });

  const cleanup = async () => {
    if (s1.connected) s1.disconnect();
    if (s2.connected) s2.disconnect();
    ioServer.close();
    await new Promise((resolve) => server.close(resolve));
    closeDb();
  };
  t.after(cleanup);

  await Promise.all([waitForConnect(s1), waitForConnect(s2)]);
  await sleep(20);
  let status = db.prepare("SELECT status FROM players WHERE id=?").get(playerId)?.status;
  assert.equal(status, "online");

  s1.disconnect();
  await sleep(50);
  status = db.prepare("SELECT status FROM players WHERE id=?").get(playerId)?.status;
  assert.equal(status, "online");

  for (let i = 0; i < 20; i += 1) {
    s2.disconnect();
    await sleep(30);
    s2.connect();
    await waitForConnect(s2);
    await sleep(20);
    status = db.prepare("SELECT status FROM players WHERE id=?").get(playerId)?.status;
    assert.equal(status, "online");
  }

  ioServer.to(`player:${playerId}`).disconnectSockets(true);
  await sleep(150);
  status = db.prepare("SELECT status FROM players WHERE id=?").get(playerId)?.status;
  assert.equal(status, "offline");
});
