import fs from "node:fs";
import path from "node:path";
import { initDb, getDb } from "./db.js";
import { uploadsDir as defaultUploadsDir } from "./paths.js";

const DEFAULT_GRACE_HOURS = 72;
const DEFAULT_ALLOW_SUBDIRS = ["assets", "bestiary", "monsters"];

function isWin() {
  return process.platform === "win32";
}

function normalizeForSet(p) {
  const resolved = path.resolve(p);
  return isWin() ? resolved.toLowerCase() : resolved;
}

function isInside(baseDir, targetPath) {
  const base = path.resolve(baseDir);
  const target = path.resolve(targetPath);
  const prefix = isWin() ? base.toLowerCase() : base;
  const cmp = isWin() ? target.toLowerCase() : target;
  return cmp === prefix || cmp.startsWith(prefix + path.sep);
}

function parseArgs(argv) {
  const out = {
    apply: false,
    graceHours: DEFAULT_GRACE_HOURS,
    allowSubdirs: DEFAULT_ALLOW_SUBDIRS.slice(),
    allowExts: [],
    uploadsDir: defaultUploadsDir
  };

  for (const raw of argv) {
    if (raw === "--apply") out.apply = true;
    else if (raw.startsWith("--grace-hours=")) {
      const v = Number(raw.split("=", 2)[1]);
      if (Number.isFinite(v) && v >= 0) out.graceHours = v;
    } else if (raw.startsWith("--allow-subdirs=")) {
      const v = raw.split("=", 2)[1];
      out.allowSubdirs = v.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (raw.startsWith("--allow-exts=") || raw.startsWith("--allow-ext=") || raw.startsWith("--ext=")) {
      const v = raw.split("=", 2)[1];
      out.allowExts = v.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    } else if (raw.startsWith("--uploads-dir=")) {
      const v = raw.split("=", 2)[1];
      if (v) out.uploadsDir = path.resolve(v);
    }
  }

  return out;
}

function extractUploadsRefs(text) {
  if (!text) return [];
  const out = [];
  const re = /\/uploads\/([a-zA-Z0-9_\-./%]+)/g;
  let m;
  while ((m = re.exec(String(text)))) {
    const relRaw = m[1];
    if (!relRaw) continue;
    let rel = relRaw;
    try {
      rel = decodeURIComponent(relRaw);
    } catch {
      // keep raw
    }
    out.push(rel.replace(/\\/g, "/"));
  }
  return out;
}

function collectLivePaths(db, uploadsDir) {
  const live = new Set();

  const addRel = (rel) => {
    if (!rel) return;
    const safeRel = String(rel).replace(/^\/+/, "");
    const abs = path.resolve(uploadsDir, safeRel);
    if (!isInside(uploadsDir, abs)) return;
    live.add(normalizeForSet(abs));
  };

  const addBothBestiaryPaths = (filename) => {
    const safeName = path.basename(String(filename || ""));
    if (!safeName) return;
    addRel(path.join("bestiary", safeName));
    addRel(path.join("monsters", safeName));
  };

  const monsterImages = db.prepare("SELECT filename FROM monster_images").all();
  for (const r of monsterImages) addBothBestiaryPaths(r.filename);

  const avatars = db.prepare("SELECT avatar_url AS url FROM character_profiles WHERE avatar_url IS NOT NULL").all();
  for (const r of avatars) {
    for (const rel of extractUploadsRefs(r.url)) addRel(rel);
  }

  const inv = db.prepare("SELECT image_url AS url FROM inventory_items WHERE image_url IS NOT NULL").all();
  for (const r of inv) {
    for (const rel of extractUploadsRefs(r.url)) addRel(rel);
  }

  const blocks = db.prepare("SELECT content FROM info_blocks").all();
  for (const r of blocks) {
    for (const rel of extractUploadsRefs(r.content)) addRel(rel);
  }

  return live;
}

function walkFiles(dir, onFile) {
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const p = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (ent.isFile()) onFile(p);
    }
  }
}

export function scanAndCleanupUploads(options = {}) {
  const {
    apply = false,
    graceHours = DEFAULT_GRACE_HOURS,
    allowSubdirs = DEFAULT_ALLOW_SUBDIRS,
    allowExts = [],
    uploadsDir = defaultUploadsDir,
    log = console
  } = options;

  const graceMs = Math.max(0, Number(graceHours) * 60 * 60 * 1000);
  const allowSet = new Set((allowSubdirs || []).map((s) => String(s || "").trim()).filter(Boolean));
  const extSet = new Set((allowExts || []).map((s) => s.startsWith(".") ? s : `.${s}`));

  initDb();
  const db = getDb();
  const live = collectLivePaths(db, uploadsDir);

  const candidates = [];
  let scanned = 0;
  let totalBytes = 0;
  let skippedLive = 0;
  let skippedYoung = 0;
  let skippedExt = 0;
  let skippedOutside = 0;

  for (const sub of allowSet) {
    const dir = path.join(uploadsDir, sub);
    if (!fs.existsSync(dir)) continue;
    walkFiles(dir, (filePath) => {
      scanned++;
      const abs = path.resolve(filePath);
      if (!isInside(uploadsDir, abs)) {
        skippedOutside++;
        return;
      }
      const ext = path.extname(abs).toLowerCase();
      if (extSet.size && !extSet.has(ext)) {
        skippedExt++;
        return;
      }

      let stat;
      try {
        stat = fs.statSync(abs);
      } catch {
        return;
      }
      const size = Number(stat.size || 0);
      totalBytes += size;

      const ageMs = Date.now() - Number(stat.mtimeMs || 0);
      if (ageMs < graceMs) {
        skippedYoung++;
        return;
      }

      const key = normalizeForSet(abs);
      if (live.has(key)) {
        skippedLive++;
        return;
      }

      candidates.push({
        path: abs,
        rel: path.relative(uploadsDir, abs).replace(/\\/g, "/"),
        size,
        ageHours: ageMs / (60 * 60 * 1000),
        reason: "not_referenced_and_older_than_grace"
      });
    });
  }

  let deleted = 0;
  let deletedBytes = 0;

  if (apply) {
    for (const c of candidates) {
      if (!isInside(uploadsDir, c.path)) continue;
      try {
        fs.unlinkSync(c.path);
        deleted++;
        deletedBytes += c.size;
      } catch {
        // best-effort
      }
    }
  }

  const summary = {
    apply,
    uploadsDir,
    graceHours,
    scanned,
    totalBytes,
    candidates: candidates.length,
    deleted,
    deletedBytes,
    skippedLive,
    skippedYoung,
    skippedExt,
    skippedOutside
  };

  if (log) {
    const mode = apply ? "APPLY" : "DRY-RUN";
    log.log(`[cleanup-uploads] mode=${mode} uploadsDir=${uploadsDir}`);
    for (const c of candidates) {
      log.log(`[candidate] ${c.rel} | age=${c.ageHours.toFixed(1)}h | size=${c.size} | reason=${c.reason}`);
    }
    log.log(
      `[summary] scanned=${summary.scanned} totalBytes=${summary.totalBytes} candidates=${summary.candidates} deleted=${summary.deleted} deletedBytes=${summary.deletedBytes} skippedLive=${summary.skippedLive} skippedYoung=${summary.skippedYoung} skippedExt=${summary.skippedExt} skippedOutside=${summary.skippedOutside}`
    );
  }

  return { summary, candidates, liveCount: live.size };
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
  const opts = parseArgs(process.argv.slice(2));
  scanAndCleanupUploads(opts);
}
