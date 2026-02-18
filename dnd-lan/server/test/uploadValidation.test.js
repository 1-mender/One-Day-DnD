import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-upload-validation-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "test_secret";
process.env.DM_COOKIE = "dm_token_test";

const { initDb, getDb } = await import("../src/db.js");
const { createDmUser, signDmToken } = await import("../src/auth.js");
const { ensureUploads } = await import("../src/uploads.js");
const { infoUploadsRouter } = await import("../src/routes/infoUploads.js");
const { bestiaryImagesRouter } = await import("../src/routes/bestiaryImages.js");
const { now } = await import("../src/util.js");

initDb();
ensureUploads();
const dmUser = createDmUser("dm", "secret123");

const app = express();
app.use(cookieParser());
app.use("/api/info-blocks", infoUploadsRouter);
app.use("/api/bestiary", bestiaryImagesRouter);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
});

function dmCookie() {
  return `${process.env.DM_COOKIE}=${signDmToken(dmUser)}`;
}

function createMonster(name = "Goblin") {
  const db = getDb();
  const t = now();
  return db.prepare(
    "INSERT INTO monsters(name, type, habitat, cr, stats, abilities, description, is_hidden, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)"
  ).run(name, "beast", "cave", "1/4", "{}", "[]", "", 0, t, t).lastInsertRowid;
}

async function upload(pathname, { field = "file", body, mime, filename = "payload.bin", cookie = dmCookie() } = {}) {
  const form = new FormData();
  form.append(field, new Blob([body], { type: mime }), filename);
  const res = await fetch(`${base}${pathname}`, {
    method: "POST",
    headers: cookie ? { cookie } : {},
    body: form
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7f8aQAAAAASUVORK5CYII=",
  "base64"
);
const FAKE_BINARY = Buffer.from([0x00, 0xff, 0x88, 0x13, 0x00, 0x45, 0x99, 0xaa]);

test("info upload rejects spoofed image payload", async () => {
  const out = await upload("/api/info-blocks/upload", {
    body: FAKE_BINARY,
    mime: "image/png",
    filename: "avatar.png"
  });
  assert.equal(out.res.status, 415);
  assert.equal(out.data.error, "unsupported_file_type");
});

test("info upload normalizes extension by detected MIME", async () => {
  const out = await upload("/api/info-blocks/upload", {
    body: PNG_1X1,
    mime: "image/png",
    filename: "evil.html"
  });
  assert.equal(out.res.status, 200);
  assert.equal(out.data.ok, true);
  assert.match(String(out.data.url || ""), /^\/uploads\/assets\/.+\.png$/);
  assert.equal(out.data.mime, "image/png");
});

test("bestiary upload rejects spoofed image payload", async () => {
  const monsterId = createMonster();
  const out = await upload(`/api/bestiary/${monsterId}/images`, {
    body: FAKE_BINARY,
    mime: "image/png",
    filename: "monster.png"
  });
  assert.equal(out.res.status, 415);
  assert.equal(out.data.error, "unsupported_file_type");
});
