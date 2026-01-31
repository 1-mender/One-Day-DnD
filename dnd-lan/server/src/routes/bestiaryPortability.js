import express from "express";
import multer from "multer";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getParty } from "../db.js";
import { now, wrapMulter } from "../util.js";
import { logEvent } from "../events.js";

export const bestiaryPortabilityRouter = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

function safeJsonParse(buf) {
  const text = Buffer.isBuffer(buf) ? buf.toString("utf8") : String(buf || "");
  return JSON.parse(text);
}

function normalizeMonster(m) {
  const name = String(m?.name || "").trim();
  if (!name) return null;

  const origIdRaw = m?.id;
  const origId = Number.isFinite(Number(origIdRaw)) && Number(origIdRaw) > 0 ? Number(origIdRaw) : null;

  const type = m?.type == null ? null : String(m.type);
  const habitat = m?.habitat == null ? null : String(m.habitat);
  const cr = m?.cr == null ? null : String(m.cr);
  const description = m?.description == null ? null : String(m.description);
  const is_hidden = m?.is_hidden ? 1 : 0;

  let stats = m?.stats ?? {};
  let abilities = m?.abilities ?? [];

  if (typeof stats === "string") {
    try { stats = JSON.parse(stats); } catch { stats = {}; }
  }
  if (typeof abilities === "string") {
    try { abilities = JSON.parse(abilities); } catch { abilities = []; }
  }

  if (typeof stats !== "object" || stats === null || Array.isArray(stats)) stats = {};
  if (!Array.isArray(abilities)) abilities = [];

  const images = Array.isArray(m?.images) ? m.images : [];

  return { origId, name, type, habitat, cr, stats, abilities, description, is_hidden, images };
}

function pickParam(req, key, fallback) {
  const qv = req.query?.[key];
  const bv = req.body?.[key];
  return (qv ?? bv ?? fallback);
}

bestiaryPortabilityRouter.get("/export", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const withImages = String(req.query.withImages || "1") === "1";

  const monsters = db.prepare("SELECT * FROM monsters ORDER BY name COLLATE NOCASE ASC").all();

  let imagesByMonster = new Map();
  if (withImages) {
    const rows = db
      .prepare("SELECT id, monster_id, filename, original_name, mime, created_at FROM monster_images ORDER BY id DESC")
      .all();
    for (const r of rows) {
      const arr = imagesByMonster.get(r.monster_id) || [];
      arr.push({
        id: r.id,
        filename: r.filename,
        url: `/uploads/bestiary/${r.filename}`,
        originalName: r.original_name,
        mime: r.mime,
        createdAt: r.created_at
      });
      imagesByMonster.set(r.monster_id, arr);
    }
  }

  const payload = {
    version: "bestiary-export-v1",
    exportedAt: now(),
    withImages,
    monsters: monsters.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      habitat: m.habitat,
      cr: m.cr,
      stats: (() => { try { return JSON.parse(m.stats || "{}"); } catch { return {}; } })(),
      abilities: (() => { try { return JSON.parse(m.abilities || "[]"); } catch { return []; } })(),
      description: m.description,
      is_hidden: !!m.is_hidden,
      images: withImages ? (imagesByMonster.get(m.id) || []) : []
    }))
  };

  const filename = `bestiary_${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(JSON.stringify(payload, null, 2));
});

bestiaryPortabilityRouter.post("/import", dmAuthMiddleware, wrapMulter(upload.single("file")), (req, res) => {
  const db = getDb();
  const mode = String(pickParam(req, "mode", "merge")).toLowerCase();
  const match = String(pickParam(req, "match", "name")).toLowerCase();
  const onExisting = String(pickParam(req, "onExisting", "update")).toLowerCase();
  const imagesMeta = String(pickParam(req, "imagesMeta", "0")) === "1";
  const dryRun = String(pickParam(req, "dryRun", "0")) === "1";

  if (!["merge", "replace"].includes(mode)) return res.status(400).json({ error: "bad_mode" });
  if (!["name", "id"].includes(match)) return res.status(400).json({ error: "bad_match" });
  if (!["update", "skip"].includes(onExisting)) return res.status(400).json({ error: "bad_onExisting" });

  let data;
  try {
    if (req.file?.buffer) data = safeJsonParse(req.file.buffer);
    else data = req.body;
  } catch {
    return res.status(400).json({ error: "invalid_json" });
  }

  const list = Array.isArray(data) ? data : Array.isArray(data?.monsters) ? data.monsters : null;
  if (!list) return res.status(400).json({ error: "invalid_format" });

  const normalized = [];
  const warnings = [];
  for (const raw of list) {
    const m = normalizeMonster(raw);
    if (!m) {
      warnings.push("Пропущена запись без name");
      continue;
    }
    normalized.push(m);
  }
  // soft warning for duplicate ids inside import file (replace mode will ignore dup ids)
  const seenIds = new Set();
  const dupIds = new Set();
  for (const m of normalized) {
    if (!m.origId) continue;
    if (seenIds.has(m.origId)) dupIds.add(m.origId);
    else seenIds.add(m.origId);
  }
  if (dupIds.size) {
    const listIds = Array.from(dupIds).slice(0, 6).join(", ");
    warnings.push(`В импорте есть дубли id: ${listIds}${dupIds.size > 6 ? "…" : ""}`);
  }

  const existingCount = db.prepare("SELECT COUNT(*) AS c FROM monsters").get().c;

  function buildPlan() {
    const createdNames = [];
    const updatedNames = [];
    const skippedNames = [];

    let created = 0;
    let updated = 0;
    let skipped = 0;

    if (mode === "replace") {
      created = normalized.length;
      return {
        created,
        updated: 0,
        skipped: 0,
        willDelete: existingCount,
        samples: {
          created: normalized.slice(0, 10).map((m) => m.name),
          updated: [],
          skipped: []
        }
      };
    }

    const rows = db.prepare("SELECT id, name FROM monsters").all();
    const byId = new Set(rows.map((r) => r.id));
    const byName = new Map(rows.map((r) => [String(r.name || "").toLowerCase(), r.id]));

    for (const m of normalized) {
      const foundId =
        match === "id"
          ? (m.origId && byId.has(m.origId) ? m.origId : null)
          : (byName.get(m.name.toLowerCase()) ?? null);

      if (foundId) {
        if (onExisting === "skip") {
          skipped++;
          if (skippedNames.length < 10) skippedNames.push(m.name);
        } else {
          updated++;
          if (updatedNames.length < 10) updatedNames.push(m.name);
        }
      } else {
        created++;
        if (createdNames.length < 10) createdNames.push(m.name);
        if (match === "id" && !m.origId) {
          warnings.push(`Запись "${m.name}" без id: при match=id будет создана как новая`);
        }
      }
    }

    return {
      created,
      updated,
      skipped,
      willDelete: 0,
      samples: { created: createdNames, updated: updatedNames, skipped: skippedNames }
    };
  }

  const plan = buildPlan();

  if (dryRun) {
    return res.json({
      ok: true,
      dryRun: true,
      mode,
      match,
      onExisting,
      imagesMeta,
      ...plan,
      warnings: warnings.slice(0, 50)
    });
  }

  const t = now();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const tx = db.transaction(() => {
    if (mode === "replace") {
      db.prepare("DELETE FROM monster_images").run();
      db.prepare("DELETE FROM monsters").run();

      const usedIds = new Set();
      for (const m of normalized) {
        const stmtWithId = db.prepare(
          "INSERT INTO monsters(id, name, type, habitat, cr, stats, abilities, description, is_hidden, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)"
        );
        const stmtNoId = db.prepare(
          "INSERT INTO monsters(name, type, habitat, cr, stats, abilities, description, is_hidden, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)"
        );

        let monsterId;
        let useId = !!m.origId;
        if (useId && usedIds.has(m.origId)) {
          useId = false;
          if (warnings.length < 50) {
            warnings.push(`Дублирующий id ${m.origId} для "${m.name}": вставлен без id`);
          }
        }
        if (useId) usedIds.add(m.origId);

        if (useId) {
          monsterId = stmtWithId.run(
            m.origId,
            m.name,
            m.type,
            m.habitat,
            m.cr,
            JSON.stringify(m.stats),
            JSON.stringify(m.abilities),
            m.description,
            m.is_hidden,
            t,
            t
          ).lastInsertRowid;
        } else {
          monsterId = stmtNoId.run(
            m.name,
            m.type,
            m.habitat,
            m.cr,
            JSON.stringify(m.stats),
            JSON.stringify(m.abilities),
            m.description,
            m.is_hidden,
            t,
            t
          ).lastInsertRowid;
        }

        created++;

        if (imagesMeta && Array.isArray(m.images) && m.images.length > 0) {
          const insImg = db.prepare(
            "INSERT INTO monster_images(monster_id, filename, original_name, mime, created_at) VALUES(?,?,?,?,?)"
          );
          for (const img of m.images) {
            const filename = String(img?.filename || "").trim();
            if (!filename) continue;
            insImg.run(
              Number(monsterId),
              filename,
              String(img?.originalName || img?.original_name || ""),
              String(img?.mime || ""),
              t
            );
          }
        }
      }
      return;
    }

    const rows = db.prepare("SELECT id, name FROM monsters").all();
    const byId = new Set(rows.map((r) => r.id));
    const byName = new Map(rows.map((r) => [String(r.name || "").toLowerCase(), r.id]));

    const upd = db.prepare(
      "UPDATE monsters SET name=?, type=?, habitat=?, cr=?, stats=?, abilities=?, description=?, is_hidden=?, updated_at=? WHERE id=?"
    );
    const ins = db.prepare(
      "INSERT INTO monsters(name, type, habitat, cr, stats, abilities, description, is_hidden, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)"
    );

    const hasImg = db.prepare("SELECT 1 FROM monster_images WHERE monster_id=? AND filename=? LIMIT 1");
    const insImg = db.prepare(
      "INSERT INTO monster_images(monster_id, filename, original_name, mime, created_at) VALUES(?,?,?,?,?)"
    );

    for (const m of normalized) {
      const foundId =
        match === "id"
          ? (m.origId && byId.has(m.origId) ? m.origId : null)
          : (byName.get(m.name.toLowerCase()) ?? null);

      if (foundId) {
        if (onExisting === "skip") {
          skipped++;
          continue;
        }

        upd.run(
          m.name,
          m.type,
          m.habitat,
          m.cr,
          JSON.stringify(m.stats),
          JSON.stringify(m.abilities),
          m.description,
          m.is_hidden,
          t,
          foundId
        );
        updated++;

        if (imagesMeta && Array.isArray(m.images) && m.images.length > 0) {
          for (const img of m.images) {
            const filename = String(img?.filename || "").trim();
            if (!filename) continue;
            const exists = hasImg.get(foundId, filename);
            if (exists) continue;
            insImg.run(
              foundId,
              filename,
              String(img?.originalName || img?.original_name || ""),
              String(img?.mime || ""),
              t
            );
          }
        }
      } else {
        const monsterId = ins.run(
          m.name,
          m.type,
          m.habitat,
          m.cr,
          JSON.stringify(m.stats),
          JSON.stringify(m.abilities),
          m.description,
          m.is_hidden,
          t,
          t
        ).lastInsertRowid;

        created++;

        byId.add(Number(monsterId));
        byName.set(m.name.toLowerCase(), Number(monsterId));

        if (imagesMeta && Array.isArray(m.images) && m.images.length > 0) {
          for (const img of m.images) {
            const filename = String(img?.filename || "").trim();
            if (!filename) continue;
            insImg.run(
              Number(monsterId),
              filename,
              String(img?.originalName || img?.original_name || ""),
              String(img?.mime || ""),
              t
            );
          }
        }
      }
    }
  });

  try {
    tx();
  } catch (e) {
    return res.status(500).json({ error: "import_failed", detail: String(e?.message || e) });
  }

  req.app.locals.io?.to("dm").emit("bestiary:updated", { import: true });
  logEvent({
    partyId: getParty().id,
    type: "bestiary.import",
    actorRole: "dm",
    actorName: "DM",
    targetType: "monster",
    targetId: null,
    message: "Импорт bestiary",
    data: { mode, match, onExisting, created, updated, skipped },
    io: req.app.locals.io
  });
  res.json({
    ok: true,
    dryRun: false,
    mode,
    match,
    onExisting,
    imagesMeta,
    created,
    updated,
    skipped,
    willDelete: mode === "replace" ? existingCount : 0,
    warnings: warnings.slice(0, 50)
  });
});
