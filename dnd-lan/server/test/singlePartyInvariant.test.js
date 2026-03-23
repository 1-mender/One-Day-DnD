import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-single-party-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;

const { closeDb, DB_PATH, initDb } = await import("../src/db.js");

test.after(() => {
  closeDb();
});

test("initDb rejects databases with more than one party", () => {
  initDb();
  closeDb();

  const dbFile = new Database(DB_PATH);
  const t = Date.now();
  const secondPartyId = dbFile.prepare("INSERT INTO parties(name, join_code, created_at) VALUES(?,?,?)")
    .run("Second Party", null, t).lastInsertRowid;
  dbFile.prepare(
    "INSERT INTO party_settings(party_id, bestiary_enabled, tickets_enabled, tickets_rules, profile_presets, profile_presets_access) VALUES(?,?,?,?,?,?)"
  ).run(secondPartyId, 0, 1, "{}", "[]", "{}");
  dbFile.close();

  assert.throws(
    () => initDb(),
    (error) => error?.code === "multiple_parties_not_supported" && error?.partyCount === 2
  );
});
