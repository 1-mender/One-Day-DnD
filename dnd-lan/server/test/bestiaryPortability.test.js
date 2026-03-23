import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-bestiary-portability-"));
process.env.DND_LAN_DATA_DIR = tmpDir;
process.env.JWT_SECRET = "test_secret";
process.env.DM_COOKIE = "dm_token_test";

const { initDb, getDb, getSinglePartyId } = await import("../src/db.js");
const { createDmUser, signDmToken } = await import("../src/auth.js");
const { bestiaryPortabilityRouter } = await import("../src/routes/bestiaryPortability.js");
const { uploadsDir } = await import("../src/paths.js");

initDb();
const dmUser = createDmUser("dm", "secret123");

const app = express();
app.locals.io = { to: () => ({ emit() {} }) };
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use("/api/bestiary", bestiaryPortabilityRouter);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const bestiaryUploadsDir = path.join(uploadsDir, "bestiary");
fs.mkdirSync(bestiaryUploadsDir, { recursive: true });

test.after(() => {
  server.close();
});

function dmCookie() {
  return `${process.env.DM_COOKIE}=${signDmToken(dmUser)}`;
}

async function importBestiary(payload, query = "") {
  const form = new FormData();
  form.append(
    "file",
    new Blob([JSON.stringify(payload)], { type: "application/json" }),
    "bestiary.json"
  );
  const res = await fetch(`${base}/api/bestiary/import${query}`, {
    method: "POST",
    headers: { cookie: dmCookie() },
    body: form
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

test("bestiary import skips image metadata when file is missing", async () => {
  const payload = {
    monsters: [{
      name: "Ghost Wolf",
      images: [{
        filename: "ghost-wolf.png",
        originalName: "ghost-wolf.png",
        mime: "image/png"
      }]
    }]
  };

  const out = await importBestiary(payload, "?imagesMeta=1");
  assert.equal(out.res.status, 200);
  assert.ok(out.data.warnings.some((warning) => warning.includes("ghost-wolf.png")));

  const db = getDb();
  const partyId = getSinglePartyId();
  const monster = db.prepare("SELECT id FROM monsters WHERE party_id=? AND name=?").get(partyId, "Ghost Wolf");
  assert.ok(monster);
  const imageCount = Number(db.prepare("SELECT COUNT(*) AS c FROM monster_images WHERE monster_id=?").get(monster.id)?.c || 0);
  assert.equal(imageCount, 0);
});

test("bestiary import keeps image metadata only when file exists locally", async () => {
  const filename = "ember-drake.png";
  fs.writeFileSync(path.join(bestiaryUploadsDir, filename), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const payload = {
    monsters: [{
      name: "Ember Drake",
      images: [{
        filename,
        originalName: filename,
        mime: "image/png"
      }]
    }]
  };

  const out = await importBestiary(payload, "?imagesMeta=1");
  assert.equal(out.res.status, 200);

  const db = getDb();
  const partyId = getSinglePartyId();
  const monster = db.prepare("SELECT id FROM monsters WHERE party_id=? AND name=?").get(partyId, "Ember Drake");
  assert.ok(monster);
  const image = db.prepare("SELECT filename FROM monster_images WHERE monster_id=?").get(monster.id);
  assert.equal(image?.filename, filename);
});
