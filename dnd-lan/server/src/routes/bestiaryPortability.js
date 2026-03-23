import express from "express";
import multer from "multer";

import { dmAuthMiddleware } from "../auth.js";
import {
  buildBestiaryExportPayload,
  buildBestiaryImportPlan,
  executeBestiaryImport
} from "../bestiary/services/bestiaryPortabilityService.js";
import {
  collectDuplicateImportIdWarnings,
  normalizeMonster,
  pickPortabilityParam,
  pushBestiaryPortabilityWarning,
  safeJsonParse
} from "../bestiary/portabilityDomain.js";
import { getDb, getSinglePartyId } from "../db.js";
import { logEvent } from "../events.js";
import { now, wrapMulter } from "../util.js";

export const bestiaryPortabilityRouter = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

bestiaryPortabilityRouter.get("/export", dmAuthMiddleware, (req, res) => {
  const payload = buildBestiaryExportPayload({
    db: getDb(),
    partyId: getSinglePartyId(),
    withImages: String(req.query.withImages || "1") === "1",
    nowFn: now
  });

  const filename = `bestiary_${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(JSON.stringify(payload, null, 2));
});

bestiaryPortabilityRouter.post("/import", dmAuthMiddleware, wrapMulter(upload.single("file")), (req, res) => {
  const db = getDb();
  const partyId = getSinglePartyId();
  const mode = String(pickPortabilityParam(req, "mode", "merge")).toLowerCase();
  const match = String(pickPortabilityParam(req, "match", "name")).toLowerCase();
  const onExisting = String(pickPortabilityParam(req, "onExisting", "update")).toLowerCase();
  const imagesMeta = String(pickPortabilityParam(req, "imagesMeta", "0")) === "1";
  const dryRun = String(pickPortabilityParam(req, "dryRun", "0")) === "1";

  if (!["merge", "replace"].includes(mode)) return res.status(400).json({ error: "bad_mode" });
  if (!["name", "id"].includes(match)) return res.status(400).json({ error: "bad_match" });
  if (!["update", "skip"].includes(onExisting)) return res.status(400).json({ error: "bad_onExisting" });

  let data;
  try {
    data = req.file?.buffer ? safeJsonParse(req.file.buffer) : req.body;
  } catch {
    return res.status(400).json({ error: "invalid_json" });
  }

  const list = Array.isArray(data) ? data : Array.isArray(data?.monsters) ? data.monsters : null;
  if (!list) return res.status(400).json({ error: "invalid_format" });

  const normalized = [];
  const warnings = [];
  for (const raw of list) {
    const monster = normalizeMonster(raw);
    if (!monster) {
      pushBestiaryPortabilityWarning(warnings, "Пропущена запись без name");
      continue;
    }
    normalized.push(monster);
  }
  collectDuplicateImportIdWarnings(normalized, warnings);
  for (const monster of normalized) {
    if (match === "id" && !monster.origId) {
      pushBestiaryPortabilityWarning(
        warnings,
        `Запись "${monster.name}" без id: при match=id будет создана как новая`
      );
    }
  }

  const plan = buildBestiaryImportPlan({ db, partyId, normalized, mode, match, onExisting });
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

  let result;
  try {
    result = executeBestiaryImport({
      db,
      partyId,
      normalized,
      mode,
      match,
      onExisting,
      imagesMeta,
      warnings,
      nowFn: now
    });
  } catch (error) {
    return res.status(500).json({ error: "import_failed", detail: String(error?.message || error) });
  }

  req.app.locals.io?.to("dm").emit("bestiary:updated", { import: true });
  logEvent({
    partyId,
    type: "bestiary.import",
    actorRole: "dm",
    actorName: "DM",
    targetType: "monster",
    targetId: null,
    message: "Импорт bestiary",
    data: { mode, match, onExisting, ...result },
    io: req.app.locals.io
  });

  res.json({
    ok: true,
    dryRun: false,
    mode,
    match,
    onExisting,
    imagesMeta,
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    willDelete: plan.willDelete,
    warnings: warnings.slice(0, 50)
  });
});
