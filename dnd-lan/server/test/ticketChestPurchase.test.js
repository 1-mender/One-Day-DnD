import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-ticket-chest-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "test_secret";

const { getDb, initDb, getSinglePartyId, setPartySettings } = await import("../src/db.js");
const { ticketsRouter } = await import("../src/routes/tickets.js");
const { now } = await import("../src/util.js");

initDb();

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use("/api/tickets", ticketsRouter);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
});

function createPlayer(displayName = "Chest Player") {
  const db = getDb();
  const partyId = getSinglePartyId();
  const t = now();
  return Number(db.prepare(
    "INSERT INTO players(party_id, display_name, status, last_seen, banned, created_at) VALUES(?,?,?,?,?,?)"
  ).run(partyId, displayName, "offline", t, 0, t).lastInsertRowid);
}

function createSession(playerId) {
  const db = getDb();
  const t = now();
  const token = `tok_${playerId}_${t}`;
  const expiresAt = t + 7 * 24 * 60 * 60 * 1000;
  db.prepare(
    "INSERT INTO sessions(token, player_id, party_id, created_at, expires_at, revoked, impersonated, impersonated_write) VALUES(?,?,?,?,?,?,?,?)"
  ).run(token, playerId, getSinglePartyId(), t, expiresAt, 0, 0, 0);
  return token;
}

function seedTickets(playerId, balance = 20) {
  const db = getDb();
  const t = now();
  db.prepare(
    "INSERT INTO tickets(player_id, balance, daily_earned, daily_spent, updated_at) VALUES(?,?,?,?,?)"
  ).run(playerId, balance, 0, 0, t);
}

function fillBackpack(playerId) {
  const db = getDb();
  const t = now();
  const insert = db.prepare(
    "INSERT INTO inventory_items(player_id, name, description, image_url, qty, weight, rarity, tags, visibility, inv_container, slot_x, slot_y, updated_at, updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  );
  for (let y = 0; y < 100; y += 1) {
    for (let x = 0; x < 6; x += 1) {
      insert.run(
        playerId,
        `Item ${x}-${y}`,
        "",
        null,
        1,
        0,
        "common",
        "[]",
        "public",
        "backpack",
        x,
        y,
        t,
        "test"
      );
    }
  }
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

test("chest purchase grants inventory reward and deducts price", async () => {
  const playerId = createPlayer("Chest Winner");
  const token = createSession(playerId);
  seedTickets(playerId, 20);

  const out = await api("/api/tickets/purchase", {
    method: "POST",
    headers: { "x-player-token": token },
    body: { itemKey: "chest" }
  });

  assert.equal(out.res.status, 200);
  assert.equal(out.data.result.itemKey, "chest");
  assert.equal(out.data.result.price, 7);
  assert.equal(out.data.result.reward.type, "inventory_item");
  assert.ok(out.data.result.reward.name);
  assert.ok(out.data.result.reward.iconKey);

  const db = getDb();
  const ticketRow = db.prepare("SELECT balance, daily_spent FROM tickets WHERE player_id=?").get(playerId);
  assert.equal(Number(ticketRow.balance), 13);
  assert.equal(Number(ticketRow.daily_spent), 7);

  const purchaseRow = db.prepare("SELECT COUNT(*) AS c FROM ticket_purchases WHERE player_id=? AND item_key='chest'").get(playerId);
  assert.equal(Number(purchaseRow.c), 1);

  const inventoryRow = db.prepare("SELECT * FROM inventory_items WHERE player_id=?").get(playerId);
  assert.ok(inventoryRow);
  assert.equal(inventoryRow.name, out.data.result.reward.name);
});

test("chest purchase rolls back when backpack is full", async () => {
  const playerId = createPlayer("Full Backpack");
  const token = createSession(playerId);
  seedTickets(playerId, 20);
  fillBackpack(playerId);

  const out = await api("/api/tickets/purchase", {
    method: "POST",
    headers: { "x-player-token": token },
    body: { itemKey: "chest" }
  });

  assert.equal(out.res.status, 409);
  assert.equal(out.data.error, "inventory_full");

  const db = getDb();
  const ticketRow = db.prepare("SELECT balance, daily_spent FROM tickets WHERE player_id=?").get(playerId);
  assert.equal(Number(ticketRow.balance), 20);
  assert.equal(Number(ticketRow.daily_spent), 0);

  const purchaseRow = db.prepare("SELECT COUNT(*) AS c FROM ticket_purchases WHERE player_id=? AND item_key='chest'").get(playerId);
  assert.equal(Number(purchaseRow.c), 0);

  const inventoryCount = db.prepare("SELECT COUNT(*) AS c FROM inventory_items WHERE player_id=?").get(playerId);
  assert.equal(Number(inventoryCount.c), 600);
});

test("global daily shop cap blocks further purchases for the day", async () => {
  const playerId = createPlayer("Shop Cap");
  const token = createSession(playerId);
  seedTickets(playerId, 20);

  setPartySettings(getSinglePartyId(), {
    tickets_enabled: 1,
    tickets_rules: JSON.stringify({ dailyShopCap: 1 })
  });

  const first = await api("/api/tickets/purchase", {
    method: "POST",
    headers: { "x-player-token": token },
    body: { itemKey: "luck" }
  });
  assert.equal(first.res.status, 200);

  const second = await api("/api/tickets/purchase", {
    method: "POST",
    headers: { "x-player-token": token },
    body: { itemKey: "reroll" }
  });
  assert.equal(second.res.status, 400);
  assert.equal(second.data.error, "daily_shop_limit");
});
