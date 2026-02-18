import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-migrations-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;

const { initDb, getDb, closeDb } = await import("../src/db.js");

test.after(() => {
  closeDb();
});

test("schema_migrations is created and stable across restarts", () => {
  initDb();
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS c FROM schema_migrations").get();
  const firstCount = Number(row?.c || 0);
  assert.ok(firstCount >= 1);

  closeDb();
  initDb();
  const db2 = getDb();
  const row2 = db2.prepare("SELECT COUNT(*) AS c FROM schema_migrations").get();
  assert.equal(Number(row2?.c || 0), firstCount);
});

test("migration backup is created", () => {
  const backupDir = path.join(tmpDir, "backups", "migrations");
  const exists = fs.existsSync(backupDir);
  assert.equal(exists, true);
  const files = fs.readdirSync(backupDir).filter((f) => f.endsWith(".bak"));
  assert.ok(files.length >= 1);
});
