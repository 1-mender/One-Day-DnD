import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import sharp from "sharp";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-upload-validation-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "test_secret";
process.env.DM_COOKIE = "dm_token_test";

const { initDb, getDb, getSinglePartyId, setPartySettings } = await import("../src/db.js");
const { createDmUser, signDmToken } = await import("../src/auth.js");
const { ensureUploads } = await import("../src/uploads.js");
const { uploadsDir } = await import("../src/paths.js");
const { bestiaryRouter } = await import("../src/routes/bestiary.js");
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
app.use("/api/bestiary", bestiaryRouter);

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
  const partyId = getSinglePartyId();
  const t = now();
  return db.prepare(
    "INSERT INTO monsters(party_id, name, type, habitat, cr, stats, abilities, description, is_hidden, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)"
  ).run(partyId, name, "beast", "cave", "1/4", "{}", "[]", "", 0, t, t).lastInsertRowid;
}

function createPlayer(displayName = "Uploader") {
  const db = getDb();
  const partyId = getSinglePartyId();
  const t = now();
  return Number(
    db.prepare(
      "INSERT INTO players(party_id, display_name, status, last_seen, banned, created_at) VALUES(?,?,?,?,?,?)"
    ).run(partyId, displayName, "offline", t, 0, t).lastInsertRowid
  );
}

function createPlayerSession(playerId, token = `player-${Date.now()}-${Math.random()}`) {
  const db = getDb();
  const partyId = getSinglePartyId();
  const t = now();
  db.prepare(
    "INSERT INTO sessions(token, player_id, party_id, created_at, expires_at, revoked, impersonated, impersonated_write) VALUES(?,?,?,?,?,?,?,?)"
  ).run(token, playerId, partyId, t, t + 3600, 0, 0, 0);
  return token;
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
const AVIF_1X1 = await sharp({
  create: {
    width: 1,
    height: 1,
    channels: 3,
    background: { r: 180, g: 140, b: 90 }
  }
}).avif({ quality: 70 }).toBuffer();
const INFO_ASSETS_DIR = path.join(uploadsDir, "assets");

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForDirEntryCount(dirPath, expectedCount, { timeoutMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const count = fs.readdirSync(dirPath).length;
    if (count === expectedCount) return count;
    await sleep(25);
  }
  return fs.readdirSync(dirPath).length;
}

test.describe("upload validation routes", { concurrency: false }, () => {
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

test("info upload accepts heif-family images and normalizes them to jpeg", async () => {
  const out = await upload("/api/info-blocks/upload", {
    body: AVIF_1X1,
    mime: "image/avif",
    filename: "lore-image.avif"
  });
  assert.equal(out.res.status, 200);
  assert.equal(out.data.ok, true);
  assert.match(String(out.data.url || ""), /^\/uploads\/assets\/.+\.jpg$/);
  assert.equal(out.data.mime, "image/jpeg");
  assert.match(String(out.data.markdown || ""), /^!\[\]\(\/uploads\/assets\/.+\.jpg\)$/);
});

test("info upload removes rejected dangerous files from disk", async () => {
  const before = fs.readdirSync(INFO_ASSETS_DIR).length;
  const out = await upload("/api/info-blocks/upload", {
    body: FAKE_BINARY,
    mime: "application/x-msdownload",
    filename: "payload.exe"
  });
  const after = await waitForDirEntryCount(INFO_ASSETS_DIR, before);

  assert.equal(out.res.status, 415);
  assert.equal(out.data.error, "unsupported_file_type");
  assert.equal(after, before);
});

test("info upload does not fall back to player avatar branch when DM cookie is invalid", async () => {
  const playerId = createPlayer("Avatar Fallback");
  const playerToken = createPlayerSession(playerId, "player-upload-token");
  const out = await upload("/api/info-blocks/upload", {
    body: PNG_1X1,
    mime: "image/png",
    filename: "avatar.png",
    cookie: `${process.env.DM_COOKIE}=broken-token`
  });

  assert.equal(out.res.status, 401);
  assert.equal(out.data.error, "not_authenticated");

  const playerOut = await fetch(`${base}/api/info-blocks/upload`, {
    method: "POST",
    headers: { "x-player-token": playerToken },
    body: (() => {
      const form = new FormData();
      form.append("file", new Blob([PNG_1X1], { type: "image/png" }), "avatar.png");
      return form;
    })()
  });
  const playerData = await playerOut.json().catch(() => ({}));
  assert.equal(playerOut.status, 404);
  assert.equal(playerData.error, "profile_not_created");
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

test("bestiary upload accepts heif-family images and normalizes them to jpeg", async () => {
  const monsterId = createMonster("Phone Photo");
  const out = await upload(`/api/bestiary/${monsterId}/images`, {
    body: AVIF_1X1,
    mime: "image/avif",
    filename: "phone.avif"
  });
  assert.equal(out.res.status, 200);
  assert.equal(out.data.ok, true);
  assert.match(String(out.data.image?.url || ""), /^\/uploads\/bestiary\/.+\.jpg$/);
  assert.equal(out.data.image?.mime, "image/jpeg");
});

test("player bestiary images endpoint requires player auth for non-DM reads", async () => {
  const monsterId = createMonster("Visible Beast");
  setPartySettings(getSinglePartyId(), { bestiary_enabled: 1 });
  const uploadOut = await upload(`/api/bestiary/${monsterId}/images`, {
    body: PNG_1X1,
    mime: "image/png",
    filename: "monster.png"
  });
  assert.equal(uploadOut.res.status, 200);

  const anonRes = await fetch(`${base}/api/bestiary/images?ids=${monsterId}&limitPer=1`);
  const anonData = await anonRes.json().catch(() => ({}));
  assert.equal(anonRes.status, 401);
  assert.equal(anonData.error, "not_authenticated");

  const anonListRes = await fetch(`${base}/api/bestiary`);
  const anonListData = await anonListRes.json().catch(() => ({}));
  assert.equal(anonListRes.status, 401);
  assert.equal(anonListData.error, "not_authenticated");

  const playerId = createPlayer("Viewer");
  const playerToken = createPlayerSession(playerId, "player-bestiary-viewer");
  const res = await fetch(`${base}/api/bestiary/images?ids=${monsterId}&limitPer=1`, {
    headers: { "x-player-token": playerToken }
  });
  const data = await res.json().catch(() => ({}));

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(data.items));
  assert.equal(data.items[0]?.monsterId, monsterId);
  assert.equal(Array.isArray(data.items[0]?.images), true);
  assert.ok(String(data.items[0]?.images?.[0]?.url || "").includes("/uploads/bestiary/"));
});

test("bestiary image delete removes generated thumbnail", async () => {
  const monsterId = createMonster("Thumb Cleanup");
  const uploadOut = await upload(`/api/bestiary/${monsterId}/images`, {
    body: PNG_1X1,
    mime: "image/png",
    filename: "monster.png"
  });
  assert.equal(uploadOut.res.status, 200);

  const imageId = Number(uploadOut.data?.image?.id || 0);
  const filename = path.basename(String(uploadOut.data?.image?.url || ""));
  const thumbPath = path.join(uploadsDir, "bestiary", "thumbs", `${filename}.thumb.webp`);
  assert.ok(imageId > 0);
  assert.ok(filename);
  assert.equal(fs.existsSync(thumbPath), true);

  const deleteRes = await fetch(`${base}/api/bestiary/images/${imageId}`, {
    method: "DELETE",
    headers: { cookie: dmCookie() }
  });
  const deleteData = await deleteRes.json().catch(() => ({}));
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteData.ok, true);
  assert.equal(fs.existsSync(thumbPath), false);
});

test("DM bestiary batch images route is not shadowed by monsterId route", async () => {
  const monsterId = createMonster("Batch Image Monster");
  const uploadOut = await upload(`/api/bestiary/${monsterId}/images`, {
    body: PNG_1X1,
    mime: "image/png",
    filename: "monster.png"
  });
  assert.equal(uploadOut.res.status, 200);

  const res = await fetch(`${base}/api/bestiary/dm/images?ids=${monsterId}&limitPer=1`, {
    headers: { cookie: dmCookie() }
  });
  const data = await res.json().catch(() => ({}));

  assert.equal(res.status, 200);
  assert.ok(data.items && typeof data.items === "object");
  assert.equal(Array.isArray(data.items[String(monsterId)]), true);
  assert.ok(String(data.items[String(monsterId)][0]?.url || "").includes("/uploads/bestiary/"));
});
});
