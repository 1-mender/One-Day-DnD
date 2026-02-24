import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-layout-test-"));
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
  db.prepare(
    "INSERT INTO sessions(token, player_id, party_id, created_at, expires_at, revoked, impersonated, impersonated_write) VALUES(?,?,?,?,?,?,?,?)"
  ).run(token, playerId, getPartyId(), t, t + 7 * 24 * 60 * 60 * 1000, 0, 0, 0);
  return token;
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

test("layout endpoint swaps two items and rejects occupied single move", async () => {
  const playerId = createPlayer("Layout Hero");
  const token = createSession(playerId);

  const first = await api("/api/inventory/mine", {
    method: "POST",
    headers: { "x-player-token": token },
    body: { name: "Torch", qty: 1, weight: 1 }
  });
  assert.equal(first.res.status, 200);
  const second = await api("/api/inventory/mine", {
    method: "POST",
    headers: { "x-player-token": token },
    body: { name: "Rope", qty: 1, weight: 1 }
  });
  assert.equal(second.res.status, 200);

  const before = await api("/api/inventory/mine", {
    headers: { "x-player-token": token }
  });
  assert.equal(before.res.status, 200);
  const torch = before.data.items.find((it) => it.name === "Torch");
  const rope = before.data.items.find((it) => it.name === "Rope");
  assert.ok(torch);
  assert.ok(rope);
  assert.equal(torch.slotX, 0);
  assert.equal(rope.slotX, 1);

  const occupiedFail = await api("/api/inventory/mine/layout", {
    method: "POST",
    headers: { "x-player-token": token },
    body: {
      moves: [{ id: torch.id, container: "backpack", slotX: rope.slotX, slotY: rope.slotY }]
    }
  });
  assert.equal(occupiedFail.res.status, 409);
  assert.equal(occupiedFail.data.error, "slot_occupied");

  const swapOk = await api("/api/inventory/mine/layout", {
    method: "POST",
    headers: { "x-player-token": token },
    body: {
      moves: [
        { id: torch.id, container: "backpack", slotX: rope.slotX, slotY: rope.slotY },
        { id: rope.id, container: "backpack", slotX: torch.slotX, slotY: torch.slotY }
      ]
    }
  });
  assert.equal(swapOk.res.status, 200);
  assert.equal(swapOk.data.updated, 2);

  const after = await api("/api/inventory/mine", {
    headers: { "x-player-token": token }
  });
  assert.equal(after.res.status, 200);
  const torchAfter = after.data.items.find((it) => it.id === torch.id);
  const ropeAfter = after.data.items.find((it) => it.id === rope.id);
  assert.equal(torchAfter.slotX, 1);
  assert.equal(ropeAfter.slotX, 0);
});

test("layout endpoint supports hotbar/equipment containers", async () => {
  const playerId = createPlayer("Container Hero");
  const token = createSession(playerId);

  const base = await api("/api/inventory/mine", {
    method: "POST",
    headers: { "x-player-token": token },
    body: { name: "Dagger", qty: 1, weight: 1 }
  });
  assert.equal(base.res.status, 200);

  const state = await api("/api/inventory/mine", {
    headers: { "x-player-token": token }
  });
  const dagger = state.data.items.find((it) => it.name === "Dagger");
  assert.ok(dagger);

  const moveHotbar = await api("/api/inventory/mine/layout", {
    method: "POST",
    headers: { "x-player-token": token },
    body: {
      moves: [{ id: dagger.id, container: "hotbar", slotX: 3, slotY: 0 }]
    }
  });
  assert.equal(moveHotbar.res.status, 200);

  const afterHotbar = await api("/api/inventory/mine", {
    headers: { "x-player-token": token }
  });
  const daggerHotbar = afterHotbar.data.items.find((it) => it.id === dagger.id);
  assert.equal(daggerHotbar.container, "hotbar");
  assert.equal(daggerHotbar.slotX, 3);
  assert.equal(daggerHotbar.slotY, 0);

  const invalid = await api("/api/inventory/mine/layout", {
    method: "POST",
    headers: { "x-player-token": token },
    body: {
      moves: [{ id: dagger.id, container: "equipment", slotX: 4, slotY: 0 }]
    }
  });
  assert.equal(invalid.res.status, 400);
  assert.equal(invalid.data.error, "invalid_slot");
});
