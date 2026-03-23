import {
  importedBestiaryImageExists,
  pushBestiaryPortabilityWarning,
  pushImageImportWarning,
  resolveImportedImageFilename
} from "../portabilityDomain.js";

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function buildImagesByMonster(db, partyId) {
  const rows = db
    .prepare(
      `SELECT mi.id, mi.monster_id, mi.filename, mi.original_name, mi.mime, mi.created_at
         FROM monster_images mi
         JOIN monsters m ON m.id=mi.monster_id
        WHERE m.party_id=?
        ORDER BY mi.id DESC`
    )
    .all(partyId);
  const imagesByMonster = new Map();
  for (const row of rows) {
    const list = imagesByMonster.get(row.monster_id) || [];
    list.push({
      id: row.id,
      filename: row.filename,
      url: `/uploads/bestiary/${row.filename}`,
      originalName: row.original_name,
      mime: row.mime,
      createdAt: row.created_at
    });
    imagesByMonster.set(row.monster_id, list);
  }
  return imagesByMonster;
}

export function buildBestiaryExportPayload({ db, partyId, withImages, nowFn }) {
  const monsters = db.prepare("SELECT * FROM monsters WHERE party_id=? ORDER BY name COLLATE NOCASE ASC").all(partyId);
  const imagesByMonster = withImages ? buildImagesByMonster(db, partyId) : new Map();
  return {
    version: "bestiary-export-v1",
    exportedAt: nowFn(),
    withImages,
    monsters: monsters.map((monster) => ({
      id: monster.id,
      name: monster.name,
      type: monster.type,
      habitat: monster.habitat,
      cr: monster.cr,
      stats: parseJson(monster.stats || "{}", {}),
      abilities: parseJson(monster.abilities || "[]", []),
      description: monster.description,
      is_hidden: !!monster.is_hidden,
      images: withImages ? (imagesByMonster.get(monster.id) || []) : []
    }))
  };
}

export function buildBestiaryImportPlan({ db, partyId, normalized, mode, match, onExisting }) {
  const existingCount = Number(db.prepare("SELECT COUNT(*) AS c FROM monsters WHERE party_id=?").get(partyId)?.c || 0);
  if (mode === "replace") {
    return {
      created: normalized.length,
      updated: 0,
      skipped: 0,
      willDelete: existingCount,
      samples: {
        created: normalized.slice(0, 10).map((monster) => monster.name),
        updated: [],
        skipped: []
      }
    };
  }

  const rows = db.prepare("SELECT id, name FROM monsters WHERE party_id=?").all(partyId);
  const byId = new Set(rows.map((row) => row.id));
  const byName = new Map(rows.map((row) => [String(row.name || "").toLowerCase(), row.id]));
  const createdNames = [];
  const updatedNames = [];
  const skippedNames = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const monster of normalized) {
    const foundId =
      match === "id"
        ? (monster.origId && byId.has(monster.origId) ? monster.origId : null)
        : (byName.get(monster.name.toLowerCase()) ?? null);
    if (foundId) {
      if (onExisting === "skip") {
        skipped += 1;
        if (skippedNames.length < 10) skippedNames.push(monster.name);
      } else {
        updated += 1;
        if (updatedNames.length < 10) updatedNames.push(monster.name);
      }
      continue;
    }
    created += 1;
    if (createdNames.length < 10) createdNames.push(monster.name);
  }

  return {
    created,
    updated,
    skipped,
    willDelete: 0,
    samples: { created: createdNames, updated: updatedNames, skipped: skippedNames }
  };
}

function importMonsterImages({
  monsterId,
  monsterName,
  images,
  nowValue,
  warnings,
  insertImageStmt,
  hasExistingImageStmt = null
}) {
  if (!Array.isArray(images) || !images.length) return;
  for (const image of images) {
    const filename = resolveImportedImageFilename(image);
    if (!filename) continue;
    if (!importedBestiaryImageExists(filename)) {
      pushImageImportWarning(warnings, monsterName, filename);
      continue;
    }
    if (hasExistingImageStmt?.get(monsterId, filename)) continue;
    insertImageStmt.run(
      Number(monsterId),
      filename,
      String(image?.originalName || image?.original_name || ""),
      String(image?.mime || ""),
      nowValue
    );
  }
}

function replaceBestiary({ db, partyId, normalized, imagesMeta, nowValue, warnings }) {
  let created = 0;
  db.prepare("DELETE FROM monsters WHERE party_id=?").run(partyId);

  const usedIds = new Set();
  const occupiedIds = new Set(db.prepare("SELECT id FROM monsters").all().map((row) => Number(row.id)));
  const insertWithId = db.prepare(
    "INSERT INTO monsters(id, party_id, name, type, habitat, cr, stats, abilities, description, is_hidden, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)"
  );
  const insertWithoutId = db.prepare(
    "INSERT INTO monsters(party_id, name, type, habitat, cr, stats, abilities, description, is_hidden, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)"
  );
  const insertImage = db.prepare(
    "INSERT INTO monster_images(monster_id, filename, original_name, mime, created_at) VALUES(?,?,?,?,?)"
  );

  for (const monster of normalized) {
    let useId = !!monster.origId;
    if (useId && usedIds.has(monster.origId)) {
      useId = false;
      pushBestiaryPortabilityWarning(warnings, `Дублирующий id ${monster.origId} для "${monster.name}": вставлен без id`);
    }
    if (useId && occupiedIds.has(monster.origId)) {
      useId = false;
      pushBestiaryPortabilityWarning(warnings, `id ${monster.origId} is already used by another party; "${monster.name}" inserted without id`);
    }
    if (useId) {
      usedIds.add(monster.origId);
      occupiedIds.add(monster.origId);
    }

    const monsterId = useId
      ? insertWithId.run(
        monster.origId,
        partyId,
        monster.name,
        monster.type,
        monster.habitat,
        monster.cr,
        JSON.stringify(monster.stats),
        JSON.stringify(monster.abilities),
        monster.description,
        monster.is_hidden,
        nowValue,
        nowValue
      ).lastInsertRowid
      : insertWithoutId.run(
        partyId,
        monster.name,
        monster.type,
        monster.habitat,
        monster.cr,
        JSON.stringify(monster.stats),
        JSON.stringify(monster.abilities),
        monster.description,
        monster.is_hidden,
        nowValue,
        nowValue
      ).lastInsertRowid;

    created += 1;
    if (imagesMeta) {
      importMonsterImages({
        monsterId,
        monsterName: monster.name,
        images: monster.images,
        nowValue,
        warnings,
        insertImageStmt: insertImage
      });
    }
  }

  return { created, updated: 0, skipped: 0 };
}

function mergeBestiary({ db, partyId, normalized, match, onExisting, imagesMeta, nowValue, warnings }) {
  const rows = db.prepare("SELECT id, name FROM monsters WHERE party_id=?").all(partyId);
  const byId = new Set(rows.map((row) => row.id));
  const byName = new Map(rows.map((row) => [String(row.name || "").toLowerCase(), row.id]));
  const updateMonster = db.prepare(
    "UPDATE monsters SET name=?, type=?, habitat=?, cr=?, stats=?, abilities=?, description=?, is_hidden=?, updated_at=? WHERE id=? AND party_id=?"
  );
  const insertMonster = db.prepare(
    "INSERT INTO monsters(party_id, name, type, habitat, cr, stats, abilities, description, is_hidden, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)"
  );
  const hasExistingImage = db.prepare("SELECT 1 FROM monster_images WHERE monster_id=? AND filename=? LIMIT 1");
  const insertImage = db.prepare(
    "INSERT INTO monster_images(monster_id, filename, original_name, mime, created_at) VALUES(?,?,?,?,?)"
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const monster of normalized) {
    const foundId =
      match === "id"
        ? (monster.origId && byId.has(monster.origId) ? monster.origId : null)
        : (byName.get(monster.name.toLowerCase()) ?? null);

    if (foundId) {
      if (onExisting === "skip") {
        skipped += 1;
        continue;
      }
      updateMonster.run(
        monster.name,
        monster.type,
        monster.habitat,
        monster.cr,
        JSON.stringify(monster.stats),
        JSON.stringify(monster.abilities),
        monster.description,
        monster.is_hidden,
        nowValue,
        foundId,
        partyId
      );
      updated += 1;
      if (imagesMeta) {
        importMonsterImages({
          monsterId: foundId,
          monsterName: monster.name,
          images: monster.images,
          nowValue,
          warnings,
          insertImageStmt: insertImage,
          hasExistingImageStmt: hasExistingImage
        });
      }
      continue;
    }

    const monsterId = insertMonster.run(
      partyId,
      monster.name,
      monster.type,
      monster.habitat,
      monster.cr,
      JSON.stringify(monster.stats),
      JSON.stringify(monster.abilities),
      monster.description,
      monster.is_hidden,
      nowValue,
      nowValue
    ).lastInsertRowid;
    created += 1;
    byId.add(Number(monsterId));
    byName.set(monster.name.toLowerCase(), Number(monsterId));
    if (imagesMeta) {
      importMonsterImages({
        monsterId,
        monsterName: monster.name,
        images: monster.images,
        nowValue,
        warnings,
        insertImageStmt: insertImage
      });
    }
  }

  return { created, updated, skipped };
}

export function executeBestiaryImport({
  db,
  partyId,
  normalized,
  mode,
  match,
  onExisting,
  imagesMeta,
  warnings,
  nowFn
}) {
  const nowValue = nowFn();
  const tx = db.transaction(() => {
    if (mode === "replace") {
      return replaceBestiary({ db, partyId, normalized, imagesMeta, nowValue, warnings });
    }
    return mergeBestiary({
      db,
      partyId,
      normalized,
      match,
      onExisting,
      imagesMeta,
      nowValue,
      warnings
    });
  });
  return tx();
}
