import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-query-plan-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;

const { initDb, getDb, closeDb } = await import("../src/db.js");

test.after(() => {
  closeDb();
});

function explainQueryPlan(sql, ...args) {
  initDb();
  return getDb().prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map((row) => String(row.detail || ""));
}

function assertUsesIndex(plan, indexName) {
  assert.ok(
    plan.some((detail) => detail.includes(indexName)),
    `Expected query plan to use ${indexName}, got: ${plan.join(" | ")}`
  );
}

function assertNoTempSort(plan) {
  assert.equal(
    plan.some((detail) => detail.includes("USE TEMP B-TREE")),
    false,
    `Expected query plan without temp B-TREE, got: ${plan.join(" | ")}`
  );
}

test("players roster query uses party/banned covering order index", () => {
  const plan = explainQueryPlan(
    `SELECT p.id,
            p.display_name as displayName,
            p.status,
            p.last_seen as lastSeen,
            CASE WHEN cp.player_id IS NULL THEN 0 ELSE 1 END as profileCreated
     FROM players p
     LEFT JOIN character_profiles cp ON cp.player_id = p.id
     WHERE p.party_id=? AND p.banned=0
     ORDER BY p.id`,
    1
  );

  assertUsesIndex(plan, "idx_players_party_banned_id");
  assertNoTempSort(plan);
});

test("monster image list query avoids temp sort on monster/id order", () => {
  const plan = explainQueryPlan(
    `SELECT id, monster_id, filename, original_name, mime, created_at
     FROM monster_images
     WHERE monster_id IN (1,2,3)
     ORDER BY monster_id, id DESC`
  );

  assertUsesIndex(plan, "idx_monster_images_monster_id_desc");
  assertNoTempSort(plan);
});

test("transfer cleanup by item/status uses dedicated index", () => {
  const plan = explainQueryPlan(
    `SELECT DISTINCT to_player_id AS pid
     FROM item_transfers
     WHERE item_id=? AND status='pending'`,
    1
  );

  assertUsesIndex(plan, "idx_transfers_item_status_to_player");
});

test("transfer outbox query uses outbox index without temp sort", () => {
  const plan = explainQueryPlan(
    `SELECT tr.*,
            p.display_name as toName,
            i.name as itemName
     FROM item_transfers tr
     JOIN players p ON p.id = tr.to_player_id
     JOIN inventory_items i ON i.id = tr.item_id
     WHERE tr.from_player_id=? AND tr.status='pending' AND tr.expires_at>?
     ORDER BY tr.created_at DESC`,
    1,
    Date.now()
  );

  assertUsesIndex(plan, "idx_transfers_outbox_created");
  assertNoTempSort(plan);
});
