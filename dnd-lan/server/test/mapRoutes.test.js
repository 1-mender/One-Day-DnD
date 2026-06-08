import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-map-routes-"));
process.env.DND_LAN_DATA_DIR = path.join(tmpDir, "data");
process.env.DND_LAN_UPLOADS_DIR = path.join(tmpDir, "uploads");
process.env.JWT_SECRET = "test_secret";
process.env.DM_COOKIE = "dm_token_test";
process.env.MAP_UPLOAD_MAX_BYTES = "1024";

const { initDb, getDb, getSinglePartyId } = await import("../src/db.js");
const { ensureUploads } = await import("../src/uploads.js");
const { createDmUser, signDmToken } = await import("../src/auth.js");
const { mapRouter } = await import("../src/routes/map.js");
const { now } = await import("../src/util.js");
const { uploadsDir } = await import("../src/paths.js");

initDb();
ensureUploads();
const dmUser = createDmUser("dm", "secret123");

function createIoProbe() {
  const emissions = [];
  return {
    emissions,
    to(room) {
      return {
        emit(event, payload) {
          emissions.push({ room, event, payload });
          return this;
        }
      };
    }
  };
}

const io = createIoProbe();
const app = express();
app.locals.io = io;
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use("/api/map", mapRouter);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
});

function dmCookie() {
  return `${process.env.DM_COOKIE}=${signDmToken(dmUser)}`;
}

async function api(pathname, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      cookie: dmCookie(),
      ...headers
    },
    body
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

test("map location partial update returns persisted values instead of null fields", async () => {
  io.emissions.length = 0;
  const db = getDb();
  const partyId = getSinglePartyId();
  const t = now();
  db.prepare(
    `INSERT INTO map_locations(party_id, id, name, category, description, default_x, default_y, created_by, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, 'dm', ?, ?)`
  ).run(partyId, "old-town", "Old Town", "settlement", "Safe hub", 12, 34, t, t);

  const out = await api("/api/map/locations/old-town", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category: "ruins" })
  });

  assert.equal(out.res.status, 200);
  assert.equal(out.data.ok, true);
  assert.deepEqual(out.data.location, {
    id: "old-town",
    name: "Old Town",
    category: "ruins",
    description: "Safe hub",
    defaultX: 12,
    defaultY: 34,
    createdBy: "dm",
    createdAt: t,
    updatedAt: out.data.location.updatedAt
  });

  const updated = db.prepare(
    "SELECT name, category, description, default_x as defaultX, default_y as defaultY FROM map_locations WHERE party_id=? AND id=?"
  ).get(partyId, "old-town");
  assert.deepEqual(updated, {
    name: "Old Town",
    category: "ruins",
    description: "Safe hub",
    defaultX: 12,
    defaultY: 34
  });

  const updates = io.emissions.filter((entry) => entry.event === "map:locationUpdated");
  assert.equal(updates.length, 2);
  for (const update of updates) {
    assert.deepEqual(update.payload.location, out.data.location);
  }
});

test("map state returns active map alias with default proxied image url", async () => {
  const out = await api("/api/map/state");

  assert.equal(out.res.status, 200);
  assert.equal(out.data.map.imageUrl, "/api/map/default-image");
  assert.equal(out.data.activeMap.url, "/api/map/default-image");
  assert.equal(Array.isArray(out.data.maps), true);
});

test("map list returns currently active map first after activation", async () => {
  const db = getDb();
  const partyId = getSinglePartyId();
  const t = now();
  db.prepare("DELETE FROM maps WHERE party_id=?").run(partyId);
  db.prepare("UPDATE party_settings SET active_map_id=NULL WHERE party_id=?").run(partyId);
  const first = db.prepare(
    `INSERT INTO maps(party_id, filename, name, width, height, created_by, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, 'dm', ?, ?)`
  ).run(partyId, "alpha.png", "Alpha", 1000, 800, t - 20, t - 20).lastInsertRowid;
  const second = db.prepare(
    `INSERT INTO maps(party_id, filename, name, width, height, created_by, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, 'dm', ?, ?)`
  ).run(partyId, "beta.png", "Beta", 1200, 900, t - 10, t - 10).lastInsertRowid;

  const activateOut = await api(`/api/map/maps/${first}/activate`, {
    method: "PUT"
  });
  assert.equal(activateOut.res.status, 200);

  const out = await api("/api/map/maps");
  assert.equal(out.res.status, 200);
  assert.equal(out.data.activeMap.id, first);
  assert.equal(out.data.maps[0].id, first);
  assert.equal(out.data.maps[0].isActive, true);
  assert.equal(out.data.maps[1].id, second);
  assert.equal(out.data.maps[1].isActive, false);
});

test("map list can switch back to the built-in default map without deleting uploads", async () => {
  const db = getDb();
  const partyId = getSinglePartyId();
  const t = now();
  db.prepare("DELETE FROM maps WHERE party_id=?").run(partyId);
  db.prepare("UPDATE party_settings SET active_map_id=NULL WHERE party_id=?").run(partyId);
  const uploadedId = db.prepare(
    `INSERT INTO maps(party_id, filename, name, width, height, created_by, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, 'dm', ?, ?)`
  ).run(partyId, "default-toggle.png", "Default Toggle", 1280, 720, t - 5, t - 5).lastInsertRowid;

  const activateOut = await api(`/api/map/maps/${uploadedId}/activate`, {
    method: "PUT"
  });
  assert.equal(activateOut.res.status, 200);

  const defaultOut = await api("/api/map/maps/default/activate", {
    method: "PUT"
  });
  assert.equal(defaultOut.res.status, 200);
  assert.equal(defaultOut.data.activeMap.id, "default");
  assert.equal(defaultOut.data.activeMap.url, "/api/map/default-image");
  assert.equal(defaultOut.data.maps.every((item) => item.isActive === false), true);

  const stateOut = await api("/api/map/state");
  assert.equal(stateOut.res.status, 200);
  assert.equal(stateOut.data.activeMap.id, "default");
  assert.equal(stateOut.data.map.imageUrl, "/api/map/default-image");
});

test("map delete removes file and falls back to the next active map", async () => {
  io.emissions.length = 0;
  const db = getDb();
  const partyId = getSinglePartyId();
  const t = now();
  db.prepare("DELETE FROM maps WHERE party_id=?").run(partyId);
  const activeId = db.prepare(
    `INSERT INTO maps(party_id, filename, name, width, height, created_by, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, 'dm', ?, ?)`
  ).run(partyId, "active-delete.png", "Active Delete", 1400, 900, t - 20, t).lastInsertRowid;
  const backupId = db.prepare(
    `INSERT INTO maps(party_id, filename, name, width, height, created_by, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, 'dm', ?, ?)`
  ).run(partyId, "backup-delete.png", "Backup Delete", 1000, 700, t - 40, t - 10).lastInsertRowid;
  db.prepare("UPDATE party_settings SET active_map_id=? WHERE party_id=?").run(activeId, partyId);

  fs.writeFileSync(path.join(uploadsDir, "maps", "active-delete.png"), "active");
  fs.writeFileSync(path.join(uploadsDir, "maps", "backup-delete.png"), "backup");

  const out = await api(`/api/map/maps/${activeId}`, {
    method: "DELETE"
  });

  assert.equal(out.res.status, 200);
  assert.equal(out.data.deletedMapId, activeId);
  assert.equal(out.data.activeMap.id, backupId);
  assert.equal(fs.existsSync(path.join(uploadsDir, "maps", "active-delete.png")), false);
  assert.equal(Number(db.prepare("SELECT COUNT(*) AS c FROM maps WHERE id=?").get(activeId).c || 0), 0);

  const updates = io.emissions.filter((entry) => entry.event === "map:mapsUpdated");
  assert.equal(updates.length >= 2, true);
});

test("map upload rejects spoofed non-image payloads", async () => {
  const db = getDb();
  const before = Number(db.prepare("SELECT COUNT(*) AS c FROM maps").get().c || 0);
  const mapsDir = path.join(uploadsDir, "maps");
  const filesBefore = fs.existsSync(mapsDir) ? fs.readdirSync(mapsDir).length : 0;
  const form = new FormData();
  form.append("file", new Blob([Buffer.from([0x00, 0xff, 0x88, 0x13])], { type: "image/png" }), "fake.png");

  const out = await api("/api/map/maps", {
    method: "POST",
    body: form
  });

  assert.equal(out.res.status, 415);
  assert.equal(out.data.error, "unsupported_file_type");
  assert.equal(Number(db.prepare("SELECT COUNT(*) AS c FROM maps").get().c || 0), before);
  assert.equal(fs.readdirSync(mapsDir).length, filesBefore);
});

test("map upload returns 413 when file exceeds configured limit", async () => {
  const db = getDb();
  const before = Number(db.prepare("SELECT COUNT(*) AS c FROM maps").get().c || 0);
  const form = new FormData();
  form.append("file", new Blob([Buffer.alloc(2048, 1)], { type: "image/png" }), "too-large.png");

  const out = await api("/api/map/maps", {
    method: "POST",
    body: form
  });

  assert.equal(out.res.status, 413);
  assert.equal(out.data.error, "file_too_large");
  assert.equal(Number(db.prepare("SELECT COUNT(*) AS c FROM maps").get().c || 0), before);
});
