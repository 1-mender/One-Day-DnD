import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-upload-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "test_secret";
process.env.DM_COOKIE = "dm_token_test";
process.env.BACKUP_IMPORT_MAX_BYTES = "1024";

const { getDb, initDb, getPartyId } = await import("../src/db.js");
const { signDmToken } = await import("../src/auth.js");
const { ensureUploads } = await import("../src/uploads.js");
const { infoUploadsRouter } = await import("../src/routes/infoUploads.js");
const { bestiaryImagesRouter } = await import("../src/routes/bestiaryImages.js");
const { backupRouter } = await import("../src/routes/backup.js");
const { now } = await import("../src/util.js");

initDb();
ensureUploads();

const app = express();
app.use(cookieParser());
app.use("/api/info-blocks", infoUploadsRouter);
app.use("/api/bestiary", bestiaryImagesRouter);
app.use("/api/backup", backupRouter);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
});

function dmCookie() {
  const token = signDmToken({ id: 1, username: "dm" });
  return `${process.env.DM_COOKIE}=${token}`;
}

function createMonster(name = "Goblin") {
  const db = getDb();
  const t = now();
  return db.prepare(
    "INSERT INTO monsters(name, type, habitat, cr, stats, abilities, description, is_hidden, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)"
  ).run(name, "beast", "cave", "1/4", "{}", "[]", "", 0, t, t).lastInsertRowid;
}

async function upload(pathname, field, sizeBytes, headers = {}, mime = "application/octet-stream") {
  const buf = Buffer.alloc(sizeBytes, 0x61);
  const form = new FormData();
  form.append(field, new Blob([buf], { type: mime }), "payload.bin");
  const res = await fetch(`${base}${pathname}`, {
    method: "POST",
    headers,
    body: form
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

test("infoUploads returns 413 on oversized upload", async () => {
  const cookie = dmCookie();
  const elevenMb = 10 * 1024 * 1024 + 1;
  const out = await upload("/api/info-blocks/upload", "file", elevenMb, { cookie });
  assert.equal(out.res.status, 413);
  assert.equal(out.data.error, "file_too_large");
});

test("bestiaryImages returns 413 on oversized upload", async () => {
  const cookie = dmCookie();
  const monsterId = createMonster();
  const over5Mb = 5 * 1024 * 1024 + 1;
  const out = await upload(`/api/bestiary/${monsterId}/images`, "file", over5Mb, { cookie }, "image/png");
  assert.equal(out.res.status, 413);
  assert.equal(out.data.error, "file_too_large");
});

test("backup import returns 413 on oversized upload", async () => {
  const cookie = dmCookie();
  const over1Kb = 1024 + 1;
  const out = await upload("/api/backup/import", "zip", over1Kb, { cookie });
  assert.equal(out.res.status, 413);
  assert.equal(out.data.error, "file_too_large");
});
