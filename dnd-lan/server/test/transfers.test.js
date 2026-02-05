import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-transfer-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "test_secret";

const { getDb, initDb, getPartyId } = await import("../src/db.js");
const { inventoryRouter } = await import("../src/routes/inventory.js");
const { now } = await import("../src/util.js");

initDb();

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use("/api/inventory", inventoryRouter);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
});

function createPlayer(displayName = "Player") {
  const db = getDb();
  const partyId = getPartyId();
  const t = now();
  return db.prepare(
    "INSERT INTO players(party_id, display_name, status, last_seen, banned, created_at) VALUES(?,?,?,?,?,?)"
  ).run(partyId, displayName, "offline", t, 0, t).lastInsertRowid;
}

function createSession(playerId) {
  const db = getDb();
  const t = now();
  const token = `tok_${playerId}_${t}`;
  const expiresAt = t + 7 * 24 * 60 * 60 * 1000;
  db.prepare(
    "INSERT INTO sessions(token, player_id, party_id, created_at, expires_at, revoked, impersonated, impersonated_write) VALUES(?,?,?,?,?,?,?,?)"
  ).run(token, playerId, getPartyId(), t, expiresAt, 0, 0, 0);
  return token;
}

function createItem(playerId, { name = "Sword", qty = 5, weight = 1 } = {}) {
  const db = getDb();
  const t = now();
  return db.prepare(
    "INSERT INTO inventory_items(player_id, name, description, image_url, qty, reserved_qty, weight, rarity, tags, visibility, updated_at, updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)"
  ).run(
    playerId,
    name,
    "",
    null,
    qty,
    0,
    weight,
    "common",
    "[]",
    "public",
    t,
    "player"
  ).lastInsertRowid;
}

async function api(pathname, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

test("Transfer accept moves qty without duplication and is idempotent", async () => {
  const playerA = createPlayer("Sender");
  const playerB = createPlayer("Receiver");
  const tokenA = createSession(playerA);
  const tokenB = createSession(playerB);
  const itemId = createItem(playerA, { qty: 5 });

  const createRes = await api("/api/inventory/transfers", {
    method: "POST",
    headers: { "x-player-token": tokenA },
    body: { to_player_id: playerB, item_id: itemId, qty: 2, note: "gift" }
  });
  assert.equal(createRes.res.status, 200);

  const db = getDb();
  const reservedAfter = db.prepare("SELECT reserved_qty FROM inventory_items WHERE id=?").get(itemId);
  assert.equal(reservedAfter.reserved_qty, 2);

  const acceptRes = await api(`/api/inventory/transfers/${createRes.data.id}/accept`, {
    method: "POST",
    headers: { "x-player-token": tokenB }
  });
  assert.equal(acceptRes.res.status, 200);

  const senderItem = db.prepare("SELECT qty, reserved_qty FROM inventory_items WHERE id=?").get(itemId);
  assert.equal(senderItem.qty, 3);
  assert.equal(senderItem.reserved_qty, 0);

  const receiverItem = db.prepare("SELECT qty FROM inventory_items WHERE player_id=? AND id<>?").get(playerB, itemId);
  assert.equal(receiverItem.qty, 2);

  const transferRow = db.prepare("SELECT status FROM item_transfers WHERE id=?").get(createRes.data.id);
  assert.equal(transferRow.status, "accepted");

  const acceptAgain = await api(`/api/inventory/transfers/${createRes.data.id}/accept`, {
    method: "POST",
    headers: { "x-player-token": tokenB }
  });
  assert.equal(acceptAgain.res.status, 200);

  const rejectAfter = await api(`/api/inventory/transfers/${createRes.data.id}/reject`, {
    method: "POST",
    headers: { "x-player-token": tokenB }
  });
  assert.equal(rejectAfter.res.status, 400);
  assert.equal(rejectAfter.data.error, "already_finalized");
});

test("Transfer reject returns reservation and is idempotent", async () => {
  const playerA = createPlayer("Sender2");
  const playerB = createPlayer("Receiver2");
  const tokenA = createSession(playerA);
  const tokenB = createSession(playerB);
  const itemId = createItem(playerA, { qty: 4 });

  const createRes = await api("/api/inventory/transfers", {
    method: "POST",
    headers: { "x-player-token": tokenA },
    body: { to_player_id: playerB, item_id: itemId, qty: 2 }
  });
  assert.equal(createRes.res.status, 200);

  const rejectRes = await api(`/api/inventory/transfers/${createRes.data.id}/reject`, {
    method: "POST",
    headers: { "x-player-token": tokenB }
  });
  assert.equal(rejectRes.res.status, 200);

  const db = getDb();
  const senderItem = db.prepare("SELECT qty, reserved_qty FROM inventory_items WHERE id=?").get(itemId);
  assert.equal(senderItem.qty, 4);
  assert.equal(senderItem.reserved_qty, 0);

  const transferRow = db.prepare("SELECT status FROM item_transfers WHERE id=?").get(createRes.data.id);
  assert.equal(transferRow.status, "rejected");

  const rejectAgain = await api(`/api/inventory/transfers/${createRes.data.id}/reject`, {
    method: "POST",
    headers: { "x-player-token": tokenB }
  });
  assert.equal(rejectAgain.res.status, 200);

  const acceptAfter = await api(`/api/inventory/transfers/${createRes.data.id}/accept`, {
    method: "POST",
    headers: { "x-player-token": tokenB }
  });
  assert.equal(acceptAfter.res.status, 400);
  assert.equal(acceptAfter.data.error, "already_finalized");
});

test("Expired transfer accept returns status expired and releases reservation", async () => {
  const playerA = createPlayer("Sender3");
  const playerB = createPlayer("Receiver3");
  const tokenA = createSession(playerA);
  const tokenB = createSession(playerB);
  const itemId = createItem(playerA, { qty: 5 });

  const createRes = await api("/api/inventory/transfers", {
    method: "POST",
    headers: { "x-player-token": tokenA },
    body: { to_player_id: playerB, item_id: itemId, qty: 2 }
  });
  assert.equal(createRes.res.status, 200);

  const db = getDb();
  db.prepare("UPDATE item_transfers SET expires_at=? WHERE id=?").run(now() - 1000, createRes.data.id);

  const acceptRes = await api(`/api/inventory/transfers/${createRes.data.id}/accept`, {
    method: "POST",
    headers: { "x-player-token": tokenB }
  });
  assert.equal(acceptRes.res.status, 200);
  assert.equal(acceptRes.data.status, "expired");

  const senderItem = db.prepare("SELECT qty, reserved_qty FROM inventory_items WHERE id=?").get(itemId);
  assert.equal(senderItem.qty, 5);
  assert.equal(senderItem.reserved_qty, 0);

  const receiverItem = db.prepare("SELECT COUNT(*) as c FROM inventory_items WHERE player_id=?").get(playerB);
  assert.equal(receiverItem.c, 0);

  const transferRow = db.prepare("SELECT status FROM item_transfers WHERE id=?").get(createRes.data.id);
  assert.equal(transferRow.status, "expired");
});

test("Expired transfer cancel returns status expired and releases reservation", async () => {
  const playerA = createPlayer("Sender4");
  const playerB = createPlayer("Receiver4");
  const tokenA = createSession(playerA);
  const itemId = createItem(playerA, { qty: 3 });

  const createRes = await api("/api/inventory/transfers", {
    method: "POST",
    headers: { "x-player-token": tokenA },
    body: { to_player_id: playerB, item_id: itemId, qty: 1 }
  });
  assert.equal(createRes.res.status, 200);

  const db = getDb();
  db.prepare("UPDATE item_transfers SET expires_at=? WHERE id=?").run(now() - 1000, createRes.data.id);

  const cancelRes = await api(`/api/inventory/transfers/${createRes.data.id}/cancel`, {
    method: "POST",
    headers: { "x-player-token": tokenA }
  });
  assert.equal(cancelRes.res.status, 200);
  assert.equal(cancelRes.data.status, "expired");

  const senderItem = db.prepare("SELECT qty, reserved_qty FROM inventory_items WHERE id=?").get(itemId);
  assert.equal(senderItem.qty, 3);
  assert.equal(senderItem.reserved_qty, 0);

  const transferRow = db.prepare("SELECT status FROM item_transfers WHERE id=?").get(createRes.data.id);
  assert.equal(transferRow.status, "expired");
});

test("Expired transfer reject returns status expired and releases reservation", async () => {
  const playerA = createPlayer("Sender5");
  const playerB = createPlayer("Receiver5");
  const tokenA = createSession(playerA);
  const tokenB = createSession(playerB);
  const itemId = createItem(playerA, { qty: 2 });

  const createRes = await api("/api/inventory/transfers", {
    method: "POST",
    headers: { "x-player-token": tokenA },
    body: { to_player_id: playerB, item_id: itemId, qty: 1 }
  });
  assert.equal(createRes.res.status, 200);

  const db = getDb();
  db.prepare("UPDATE item_transfers SET expires_at=? WHERE id=?").run(now() - 1000, createRes.data.id);

  const rejectRes = await api(`/api/inventory/transfers/${createRes.data.id}/reject`, {
    method: "POST",
    headers: { "x-player-token": tokenB }
  });
  assert.equal(rejectRes.res.status, 200);
  assert.equal(rejectRes.data.status, "expired");

  const senderItem = db.prepare("SELECT qty, reserved_qty FROM inventory_items WHERE id=?").get(itemId);
  assert.equal(senderItem.qty, 2);
  assert.equal(senderItem.reserved_qty, 0);

  const transferRow = db.prepare("SELECT status FROM item_transfers WHERE id=?").get(createRes.data.id);
  assert.equal(transferRow.status, "expired");
});
