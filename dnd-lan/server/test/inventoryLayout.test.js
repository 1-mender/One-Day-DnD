import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-layout-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "test_secret";

const { getDb, initDb, getSinglePartyId } = await import("../src/db.js");
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
  const partyId = getSinglePartyId();
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
  ).run(token, playerId, getSinglePartyId(), t, t + 7 * 24 * 60 * 60 * 1000, 0, 0, 0);
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

test("split endpoint creates second stack in target slot", async () => {
  const playerId = createPlayer("Split Hero");
  const token = createSession(playerId);

  const created = await api("/api/inventory/mine", {
    method: "POST",
    headers: { "x-player-token": token },
    body: { name: "Sword", qty: 4, weight: 1 }
  });
  assert.equal(created.res.status, 200);

  const state = await api("/api/inventory/mine", { headers: { "x-player-token": token } });
  const sword = state.data.items.find((it) => it.name === "Sword");
  assert.ok(sword);

  const split = await api(`/api/inventory/mine/${sword.id}/split`, {
    method: "POST",
    headers: { "x-player-token": token },
    body: { qty: 2, container: "hotbar", slotX: 2, slotY: 0 }
  });
  assert.equal(split.res.status, 200);
  assert.ok(split.data.id);

  const after = await api("/api/inventory/mine", { headers: { "x-player-token": token } });
  const swords = after.data.items.filter((it) => it.name === "Sword");
  assert.equal(swords.length, 2);
  const source = swords.find((it) => it.id === sword.id);
  const splitItem = swords.find((it) => it.id === split.data.id);
  assert.equal(source.qty, 2);
  assert.equal(splitItem.qty, 2);
  assert.equal(splitItem.container, "hotbar");
  assert.equal(splitItem.slotX, 2);
});

test("quick-equip uses type rules and swaps equipped item", async () => {
  const playerId = createPlayer("Equip Hero");
  const token = createSession(playerId);

  const sword = await api("/api/inventory/mine", {
    method: "POST",
    headers: { "x-player-token": token },
    body: { name: "Sword", qty: 1, weight: 1 }
  });
  const axe = await api("/api/inventory/mine", {
    method: "POST",
    headers: { "x-player-token": token },
    body: { name: "Axe", qty: 1, weight: 1 }
  });
  const potion = await api("/api/inventory/mine", {
    method: "POST",
    headers: { "x-player-token": token },
    body: { name: "Potion", qty: 1, weight: 1 }
  });
  assert.equal(sword.res.status, 200);
  assert.equal(axe.res.status, 200);
  assert.equal(potion.res.status, 200);

  const equipSword = await api(`/api/inventory/mine/${sword.data.id}/quick-equip`, {
    method: "POST",
    headers: { "x-player-token": token }
  });
  assert.equal(equipSword.res.status, 200);
  assert.equal(equipSword.data.slotX, 0);

  const equipAxe = await api(`/api/inventory/mine/${axe.data.id}/quick-equip`, {
    method: "POST",
    headers: { "x-player-token": token }
  });
  assert.equal(equipAxe.res.status, 200);
  assert.equal(equipAxe.data.slotX, 0);
  assert.ok(equipAxe.data.swappedItemId);

  const failPotion = await api(`/api/inventory/mine/${potion.data.id}/quick-equip`, {
    method: "POST",
    headers: { "x-player-token": token }
  });
  assert.equal(failPotion.res.status, 400);
  assert.equal(failPotion.data.error, "not_equipable");
});
