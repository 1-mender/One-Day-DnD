import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import express from "express";
import { io as clientIo } from "socket.io-client";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-presence-swap-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.PRESENCE_GRACE_MS = "100";

const { initDb, getDb, getPartyId, closeDb } = await import("../src/db.js");
const { createSocketServer } = await import("../src/sockets.js");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPlayerWithSession(db, partyId, name, tokenSeed) {
  const t = Date.now();
  const playerId = db
    .prepare("INSERT INTO players(party_id, display_name, status, last_seen, banned, created_at) VALUES(?,?,?,?,?,?)")
    .run(partyId, name, "offline", t, 0, t).lastInsertRowid;
  const token = `tok_${tokenSeed}_${playerId}`;
  db
    .prepare(
      "INSERT INTO sessions(token, player_id, party_id, created_at, expires_at, revoked, impersonated, impersonated_write) VALUES(?,?,?,?,?,?,?,?)"
    )
    .run(token, playerId, partyId, t, t + 60_000, 0, 0, 0);
  return { playerId, token };
}

test("auth:swap moves presence from A to B without disconnect", async (t) => {
  initDb();
  const db = getDb();
  const partyId = getPartyId();
  const a = createPlayerWithSession(db, partyId, "Alice", "a");
  const b = createPlayerWithSession(db, partyId, "Bob", "b");

  const app = express();
  const server = http.createServer(app);
  const ioServer = createSocketServer(server);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const socket = clientIo(baseUrl, { auth: { playerToken: a.token } });

  const cleanup = async () => {
    if (socket.connected) socket.disconnect();
    ioServer.close();
    await new Promise((resolve) => server.close(resolve));
    closeDb();
  };
  t.after(cleanup);

  await new Promise((resolve) => socket.on("connect", resolve));
  await sleep(20);

  let statusA = db.prepare("SELECT status FROM players WHERE id=?").get(a.playerId)?.status;
  let statusB = db.prepare("SELECT status FROM players WHERE id=?").get(b.playerId)?.status;
  assert.equal(statusA, "online");
  assert.equal(statusB, "offline");

  const swapResult = await new Promise((resolve) => {
    socket.emit("auth:swap", { playerToken: b.token }, (res) => resolve(res));
  });
  assert.equal(swapResult?.ok, true);

  await sleep(200);
  statusA = db.prepare("SELECT status FROM players WHERE id=?").get(a.playerId)?.status;
  statusB = db.prepare("SELECT status FROM players WHERE id=?").get(b.playerId)?.status;
  assert.equal(statusA, "offline");
  assert.equal(statusB, "online");
});
