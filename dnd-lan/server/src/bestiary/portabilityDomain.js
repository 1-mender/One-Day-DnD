import fs from "node:fs";
import path from "node:path";
import { uploadsDir } from "../paths.js";

export const BESTIARY_UPLOAD_DIR = path.join(uploadsDir, "bestiary");

export function safeJsonParse(buf) {
  const text = Buffer.isBuffer(buf) ? buf.toString("utf8") : String(buf || "");
  return JSON.parse(text);
}

export function normalizeMonster(monster) {
  const name = String(monster?.name || "").trim();
  if (!name) return null;

  const origIdRaw = monster?.id;
  const numericOrigId = Number(origIdRaw);
  const origId = Number.isFinite(numericOrigId) && numericOrigId > 0 ? numericOrigId : null;
  const type = monster?.type == null ? null : String(monster.type);
  const habitat = monster?.habitat == null ? null : String(monster.habitat);
  const cr = monster?.cr == null ? null : String(monster.cr);
  const description = monster?.description == null ? null : String(monster.description);
  const is_hidden = monster?.is_hidden ? 1 : 0;

  let stats = monster?.stats ?? {};
  let abilities = monster?.abilities ?? [];
  if (typeof stats === "string") {
    try { stats = JSON.parse(stats); } catch { stats = {}; }
  }
  if (typeof abilities === "string") {
    try { abilities = JSON.parse(abilities); } catch { abilities = []; }
  }
  if (typeof stats !== "object" || stats === null || Array.isArray(stats)) stats = {};
  if (!Array.isArray(abilities)) abilities = [];

  const images = Array.isArray(monster?.images) ? monster.images : [];
  return { origId: origId > 0 ? origId : null, name, type, habitat, cr, stats, abilities, description, is_hidden, images };
}

export function pickPortabilityParam(req, key, fallback) {
  const queryValue = req.query?.[key];
  const bodyValue = req.body?.[key];
  return queryValue ?? bodyValue ?? fallback;
}

export function pushBestiaryPortabilityWarning(warnings, message) {
  if (warnings.length >= 50) return;
  warnings.push(message);
}

export function collectDuplicateImportIdWarnings(normalized, warnings) {
  const seenIds = new Set();
  const duplicateIds = new Set();
  for (const monster of normalized) {
    if (!monster.origId) continue;
    if (seenIds.has(monster.origId)) duplicateIds.add(monster.origId);
    else seenIds.add(monster.origId);
  }
  if (!duplicateIds.size) return;
  const listIds = Array.from(duplicateIds).slice(0, 6).join(", ");
  pushBestiaryPortabilityWarning(
    warnings,
    `В импорте есть дубли id: ${listIds}${duplicateIds.size > 6 ? "…" : ""}`
  );
}

export function resolveImportedImageFilename(image) {
  const directName = String(image?.filename || "").trim();
  if (directName) return directName;
  const rawUrl = String(image?.url || "").trim();
  if (!rawUrl) return "";
  const normalized = rawUrl.replace(/\\/g, "/").split("?")[0];
  return path.basename(normalized);
}

export function importedBestiaryImageExists(filename) {
  if (!filename) return false;
  return fs.existsSync(path.join(BESTIARY_UPLOAD_DIR, filename));
}

export function pushImageImportWarning(warnings, monsterName, filename) {
  pushBestiaryPortabilityWarning(
    warnings,
    `Файл изображения "${filename}" для "${monsterName}" не найден в uploads/bestiary; metadata skipped`
  );
}
