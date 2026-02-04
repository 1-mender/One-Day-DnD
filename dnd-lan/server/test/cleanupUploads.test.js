import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-cleanup-test-"));
const uploadsDir = path.join(tmpDir, "uploads_test");
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.DND_LAN_UPLOADS_DIR = uploadsDir;

const { initDb, getDb } = await import("../src/db.js");
const { ensureUploads } = await import("../src/uploads.js");
const { scanAndCleanupUploads } = await import("../src/cleanupUploads.js");
const { now } = await import("../src/util.js");

initDb();
ensureUploads();

const db = getDb();
const t = now();

const monsterId = db.prepare(
  "INSERT INTO monsters(name, type, habitat, cr, stats, abilities, description, is_hidden, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)"
).run("KeepMonster", "beast", "cave", "1/4", "{}", "[]", "", 0, t, t).lastInsertRowid;

db.prepare(
  "INSERT INTO monster_images(monster_id, filename, original_name, mime, created_at) VALUES(?,?,?,?,?)"
).run(monsterId, "keep.png", "keep.png", "image/png", t);

const keepPath = path.join(uploadsDir, "bestiary", "keep.png");
const oldOrphanPath = path.join(uploadsDir, "assets", "old.png");
const freshOrphanPath = path.join(uploadsDir, "assets", "fresh.png");

fs.writeFileSync(keepPath, Buffer.from([0x01, 0x02]));
fs.writeFileSync(oldOrphanPath, Buffer.from([0x03, 0x04]));
fs.writeFileSync(freshOrphanPath, Buffer.from([0x05, 0x06]));

const nowMs = Date.now();
fs.utimesSync(oldOrphanPath, new Date(nowMs - 100 * 60 * 60 * 1000), new Date(nowMs - 100 * 60 * 60 * 1000));
fs.utimesSync(freshOrphanPath, new Date(nowMs - 2 * 60 * 60 * 1000), new Date(nowMs - 2 * 60 * 60 * 1000));

test("cleanup dry-run lists only old orphan", () => {
  const res = scanAndCleanupUploads({
    apply: false,
    graceHours: 48,
    uploadsDir,
    log: null
  });
  const rels = res.candidates.map((c) => c.rel);
  assert.ok(rels.includes("assets/old.png"));
  assert.ok(!rels.includes("assets/fresh.png"));
  assert.ok(!rels.includes("bestiary/keep.png"));
});

test("cleanup apply deletes old orphan only", () => {
  const res = scanAndCleanupUploads({
    apply: true,
    graceHours: 48,
    uploadsDir,
    log: null
  });
  assert.ok(res.summary.deleted >= 1);
  assert.equal(fs.existsSync(oldOrphanPath), false);
  assert.equal(fs.existsSync(freshOrphanPath), true);
  assert.equal(fs.existsSync(keepPath), true);
});
