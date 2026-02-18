import express from "express";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getParty, getPartySettings, setPartySettings } from "../db.js";
import { jsonParse, now, randId } from "../util.js";
import { getDmPayloadFromRequest, getPlayerContextFromRequest } from "../sessionAuth.js";

export const profileRouter = express.Router();

const EDITABLE_FIELDS = new Set([
  "characterName",
  "classRole",
  "level",
  "stats",
  "bio",
  "avatarUrl"
]);

const LIMITS = {
  name: 80,
  classRole: 80,
  avatarUrl: 512,
  bio: 2000,
  reason: 500,
  dmNote: 500,
  statKey: 24,
  statValue: 64,
  maxStats: 20
};

const PRESET_LIMITS = {
  title: 80,
  subtitle: 160,
  maxPresets: 30
};

const DEFAULT_PRESET_ACCESS = {
  enabled: true,
  playerEdit: true,
  playerRequest: true,
  hideLocal: false
};

function mapProfile(row) {
  const stats = jsonParse(row.stats, {});
  const editableFields = jsonParse(row.editable_fields, []);
  return {
    playerId: row.player_id,
    characterName: row.character_name || "",
    classRole: row.class_role || "",
    level: row.level == null ? null : Number(row.level),
    stats: (stats && typeof stats === "object" && !Array.isArray(stats)) ? stats : {},
    bio: row.bio || "",
    avatarUrl: row.avatar_url || "",
    editableFields: Array.isArray(editableFields) ? editableFields : [],
    allowRequests: !!row.allow_requests,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeStats(value) {
  if (value == null) return {};
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return null;
}

function normalizeEditableFields(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter((v) => EDITABLE_FIELDS.has(v));
}

function validateTextLen(value, max, errorCode) {
  if (value == null) return null;
  if (String(value).length > max) return errorCode;
  return null;
}

function validateStats(stats) {
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) return "stats_invalid";
  const keys = Object.keys(stats);
  if (keys.length > LIMITS.maxStats) return "stats_too_many";
  for (const key of keys) {
    if (String(key).length > LIMITS.statKey) return "stats_key_too_long";
    const v = stats[key];
    if (v == null) continue;
    if (typeof v === "number") continue;
    if (typeof v === "string") {
      if (v.length > LIMITS.statValue) return "stats_value_too_long";
      continue;
    }
    return "stats_invalid";
  }
  return null;
}

function normalizePresetAccess(value) {
  const v = value && typeof value === "object" ? value : {};
  return {
    enabled: typeof v.enabled === "boolean" ? v.enabled : DEFAULT_PRESET_ACCESS.enabled,
    playerEdit: typeof v.playerEdit === "boolean" ? v.playerEdit : DEFAULT_PRESET_ACCESS.playerEdit,
    playerRequest: typeof v.playerRequest === "boolean" ? v.playerRequest : DEFAULT_PRESET_ACCESS.playerRequest,
    hideLocal: typeof v.hideLocal === "boolean" ? v.hideLocal : DEFAULT_PRESET_ACCESS.hideLocal
  };
}

function normalizePresetData(raw) {
  const changes = sanitizeRequestChanges(raw || {});
  const err = validateRequestChanges(changes);
  if (err) return { error: err };
  return {
    characterName: String(changes.characterName || ""),
    classRole: String(changes.classRole || ""),
    level: changes.level === "" || changes.level == null ? "" : Number(changes.level),
    stats: changes.stats || {},
    bio: String(changes.bio || ""),
    avatarUrl: String(changes.avatarUrl || "")
  };
}

function sanitizePreset(preset, index) {
  if (!preset || typeof preset !== "object") return null;
  const title = String(preset.title || "").trim();
  if (!title) return null;
  if (title.length > PRESET_LIMITS.title) return { error: "preset_title_too_long" };
  const subtitle = String(preset.subtitle || "").trim();
  if (subtitle.length > PRESET_LIMITS.subtitle) return { error: "preset_subtitle_too_long" };
  const data = normalizePresetData(preset.data || preset);
  if (data?.error) return { error: data.error };
  const idRaw = String(preset.id || preset.key || "").trim();
  const id = idRaw ? idRaw.slice(0, 40) : `preset_${index}_${randId(4)}`;
  return { id, title, subtitle, data };
}

function buildProfilePayload(body, existing) {
  const b = body || {};

  const characterName = b.characterName ?? existing?.character_name ?? "";
  const classRole = b.classRole ?? existing?.class_role ?? "";
  const levelRaw = b.level ?? existing?.level ?? null;
  const level = levelRaw === null || levelRaw === "" || Number.isNaN(Number(levelRaw))
    ? null
    : Math.max(0, Number(levelRaw));
  let statsObj;
  if (b.stats !== undefined) {
    const normalized = normalizeStats(b.stats);
    if (normalized === null) return { error: "stats_invalid" };
    statsObj = normalized;
  } else {
    const existingStats = normalizeStats(jsonParse(existing?.stats, {}));
    statsObj = existingStats ?? {};
  }
  const bio = b.bio ?? existing?.bio ?? "";
  const avatarUrl = b.avatarUrl ?? existing?.avatar_url ?? "";
  const editableFields = b.editableFields !== undefined
    ? normalizeEditableFields(b.editableFields)
    : normalizeEditableFields(jsonParse(existing?.editable_fields, []));
  const allowRequests = b.allowRequests !== undefined ? !!b.allowRequests : !!existing?.allow_requests;

  const err = validateTextLen(characterName, LIMITS.name, "character_name_too_long")
    || validateTextLen(classRole, LIMITS.classRole, "class_role_too_long")
    || validateTextLen(avatarUrl, LIMITS.avatarUrl, "avatar_url_too_long")
    || validateTextLen(bio, LIMITS.bio, "bio_too_long")
    || validateStats(statsObj);
  if (err) return { error: err };

  return {
    character_name: String(characterName || ""),
    class_role: String(classRole || ""),
    level,
    stats: JSON.stringify(statsObj || {}),
    bio: String(bio || ""),
    avatar_url: String(avatarUrl || ""),
    editable_fields: JSON.stringify(editableFields || []),
    allow_requests: allowRequests ? 1 : 0
  };
}

function sanitizePatch(body) {
  const b = body || {};
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);

  if (has("characterName")) out.character_name = String(b.characterName || "");
  if (has("classRole")) out.class_role = String(b.classRole || "");
  if (has("level")) {
    const n = b.level === "" || b.level == null ? null : Number(b.level);
    out.level = Number.isFinite(n) ? Math.max(0, n) : null;
  }
  if (has("stats")) out.stats = normalizeStats(b.stats);
  if (has("bio")) out.bio = String(b.bio || "");
  if (has("avatarUrl")) out.avatar_url = String(b.avatarUrl || "");

  return out;
}

function sanitizeRequestChanges(body) {
  const b = body || {};
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);

  if (has("characterName")) out.characterName = String(b.characterName || "");
  if (has("classRole")) out.classRole = String(b.classRole || "");
  if (has("level")) {
    const n = b.level === "" || b.level == null ? null : Number(b.level);
    out.level = Number.isFinite(n) ? Math.max(0, n) : null;
  }
  if (has("stats")) out.stats = normalizeStats(b.stats);
  if (has("bio")) out.bio = String(b.bio || "");
  if (has("avatarUrl")) out.avatarUrl = String(b.avatarUrl || "");

  return out;
}

function validateRequestChanges(changes) {
  let err = null;
  if ("characterName" in changes) err = err || validateTextLen(changes.characterName, LIMITS.name, "character_name_too_long");
  if ("classRole" in changes) err = err || validateTextLen(changes.classRole, LIMITS.classRole, "class_role_too_long");
  if ("avatarUrl" in changes) err = err || validateTextLen(changes.avatarUrl, LIMITS.avatarUrl, "avatar_url_too_long");
  if ("bio" in changes) err = err || validateTextLen(changes.bio, LIMITS.bio, "bio_too_long");
  if ("stats" in changes) err = err || validateStats(changes.stats);
  return err;
}

function validateAndFinalizePatch(patch, { stringifyStats = true } = {}) {
  let err = null;
  if ("character_name" in patch) err = err || validateTextLen(patch.character_name, LIMITS.name, "character_name_too_long");
  if ("class_role" in patch) err = err || validateTextLen(patch.class_role, LIMITS.classRole, "class_role_too_long");
  if ("avatar_url" in patch) err = err || validateTextLen(patch.avatar_url, LIMITS.avatarUrl, "avatar_url_too_long");
  if ("bio" in patch) err = err || validateTextLen(patch.bio, LIMITS.bio, "bio_too_long");
  if ("stats" in patch) err = err || validateStats(patch.stats);
  if (err) return { error: err };

  const out = { ...patch };
  if ("stats" in out && stringifyStats) out.stats = JSON.stringify(out.stats || {});
  return { patch: out };
}

function ensureWritable(sess, res) {
  if (sess.impersonated && !sess.impersonated_write) {
    res.status(403).json({ error: "read_only_impersonation" });
    return false;
  }
  return true;
}

profileRouter.get("/profile-presets", (req, res) => {
  const dm = getDmPayloadFromRequest(req);
  const me = getPlayerContextFromRequest(req, { at: now() });
  if (!dm && !me) return res.status(403).json({ error: "forbidden" });

  const party = getParty();
  const settings = getPartySettings(party.id);
  let presets = jsonParse(settings.profile_presets, []);
  const access = normalizePresetAccess(jsonParse(settings.profile_presets_access, {}));
  presets = Array.isArray(presets) ? presets : [];
  if (!dm && me && (!access.enabled || (!access.playerEdit && !access.playerRequest))) {
    presets = [];
  }
  res.json({ presets, access });
});

profileRouter.get("/profile-presets/dm", dmAuthMiddleware, (req, res) => {
  const party = getParty();
  const settings = getPartySettings(party.id);
  const presets = jsonParse(settings.profile_presets, []);
  const access = normalizePresetAccess(jsonParse(settings.profile_presets_access, {}));
  res.json({ presets: Array.isArray(presets) ? presets : [], access });
});

profileRouter.put("/profile-presets/dm", dmAuthMiddleware, (req, res) => {
  const body = req.body || {};
  const party = getParty();

  if (body.reset) {
    setPartySettings(party.id, {
      profile_presets: "[]",
      profile_presets_access: JSON.stringify(DEFAULT_PRESET_ACCESS)
    });
    req.app.locals.io?.to("dm").emit("settings:updated");
    req.app.locals.io?.to(`party:${party.id}`).emit("settings:updated");
    return res.json({ presets: [], access: DEFAULT_PRESET_ACCESS });
  }

  const access = normalizePresetAccess(body.access);
  const rawPresets = Array.isArray(body.presets) ? body.presets : [];
  const presets = [];
  for (const preset of rawPresets) {
    if (presets.length >= PRESET_LIMITS.maxPresets) break;
    const normalized = sanitizePreset(preset, presets.length + 1);
    if (!normalized) continue;
    if (normalized.error) return res.status(400).json({ error: normalized.error });
    presets.push(normalized);
  }

  setPartySettings(party.id, {
    profile_presets: JSON.stringify(presets),
    profile_presets_access: JSON.stringify(access)
  });
  req.app.locals.io?.to("dm").emit("settings:updated");
  req.app.locals.io?.to(`party:${party.id}`).emit("settings:updated");
  res.json({ presets, access });
});

profileRouter.get("/players/:id/profile", (req, res) => {
  const playerId = Number(req.params.id);
  if (!playerId) return res.status(400).json({ error: "invalid_playerId" });

  const dm = getDmPayloadFromRequest(req);
  const me = getPlayerContextFromRequest(req, { at: now() });
  if (!dm && (!me || me.player.id !== playerId)) return res.status(403).json({ error: "forbidden" });

  const db = getDb();
  const row = db.prepare("SELECT * FROM character_profiles WHERE player_id=?").get(playerId);
  if (!row) return res.json({ notCreated: true });
  return res.json({ profile: mapProfile(row) });
});

profileRouter.put("/players/:id/profile", dmAuthMiddleware, (req, res) => {
  const playerId = Number(req.params.id);
  if (!playerId) return res.status(400).json({ error: "invalid_playerId" });

  const db = getDb();
  const existing = db.prepare("SELECT * FROM character_profiles WHERE player_id=?").get(playerId);
  const payload = buildProfilePayload(req.body, existing);
  if (payload?.error) return res.status(400).json({ error: payload.error });
  const t = now();

  if (existing) {
    db.prepare(
      `UPDATE character_profiles
       SET character_name=?, class_role=?, level=?, stats=?, bio=?, avatar_url=?,
           editable_fields=?, allow_requests=?, updated_at=?
       WHERE player_id=?`
    ).run(
      payload.character_name,
      payload.class_role,
      payload.level,
      payload.stats,
      payload.bio,
      payload.avatar_url,
      payload.editable_fields,
      payload.allow_requests,
      t,
      playerId
    );
  } else {
    const createdBy = req.dm?.u ? `dm:${req.dm.u}` : req.dm?.uid ? `dm:${req.dm.uid}` : "dm";
    db.prepare(
      `INSERT INTO character_profiles(
        player_id, character_name, class_role, level, stats, bio, avatar_url,
        editable_fields, allow_requests, created_by, created_at, updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      playerId,
      payload.character_name,
      payload.class_role,
      payload.level,
      payload.stats,
      payload.bio,
      payload.avatar_url,
      payload.editable_fields,
      payload.allow_requests,
      createdBy,
      t,
      t
    );
  }

  const row = db.prepare("SELECT * FROM character_profiles WHERE player_id=?").get(playerId);
  req.app.locals.io?.to(`player:${playerId}`).emit("profile:updated");
  req.app.locals.io?.to("dm").emit("players:updated");
  res.json({ ok: true, profile: mapProfile(row) });
});

profileRouter.patch("/players/:id/profile", (req, res) => {
  const playerId = Number(req.params.id);
  if (!playerId) return res.status(400).json({ error: "invalid_playerId" });

  const me = getPlayerContextFromRequest(req, { at: now() });
  if (!me || me.player.id !== playerId) return res.status(403).json({ error: "forbidden" });
  if (!ensureWritable(me.sess, res)) return;

  const db = getDb();
  const row = db.prepare("SELECT * FROM character_profiles WHERE player_id=?").get(playerId);
  if (!row) return res.status(404).json({ error: "profile_not_created" });

  const editableFields = normalizeEditableFields(jsonParse(row.editable_fields, []));
  const bodyKeys = Object.keys(req.body || {});
  if (!bodyKeys.length) return res.status(400).json({ error: "empty_patch" });
  for (const key of bodyKeys) {
    if (!EDITABLE_FIELDS.has(key)) return res.status(403).json({ error: "field_not_allowed", field: key });
  }

  for (const key of bodyKeys) {
    if (!editableFields.includes(key)) return res.status(403).json({ error: "field_not_allowed", field: key });
  }

  const rawPatch = sanitizePatch(req.body);
  if (!Object.keys(rawPatch).length) return res.status(400).json({ error: "empty_patch" });
  const validated = validateAndFinalizePatch(rawPatch);
  if (validated.error) return res.status(400).json({ error: validated.error });
  const patch = validated.patch;

  const t = now();
  const sets = [];
  const args = [];
  for (const [k, v] of Object.entries(patch)) {
    sets.push(`${k}=?`);
    args.push(v);
  }
  sets.push("updated_at=?");
  args.push(t, playerId);

  db.prepare(`UPDATE character_profiles SET ${sets.join(", ")} WHERE player_id=?`).run(...args);

  req.app.locals.io?.to(`player:${playerId}`).emit("profile:updated");
  req.app.locals.io?.to("dm").emit("players:updated");
  const updated = db.prepare("SELECT * FROM character_profiles WHERE player_id=?").get(playerId);
  res.json({ ok: true, profile: mapProfile(updated) });
});

profileRouter.post("/players/:id/profile-requests", (req, res) => {
  const playerId = Number(req.params.id);
  if (!playerId) return res.status(400).json({ error: "invalid_playerId" });

  const me = getPlayerContextFromRequest(req, { at: now() });
  if (!me || me.player.id !== playerId) return res.status(403).json({ error: "forbidden" });
  if (!ensureWritable(me.sess, res)) return;

  const db = getDb();
  const profile = db.prepare("SELECT allow_requests FROM character_profiles WHERE player_id=?").get(playerId);
  if (!profile) return res.status(404).json({ error: "profile_not_created" });
  if (!profile.allow_requests) return res.status(403).json({ error: "requests_disabled" });

  const body = req.body || {};
  const reason = String(body.reason || "").trim();
  const reasonErr = validateTextLen(reason, LIMITS.reason, "reason_too_long");
  if (reasonErr) return res.status(400).json({ error: reasonErr });
  const proposed = body.proposedChanges ?? body;
  const changes = sanitizeRequestChanges(proposed);
  if (!Object.keys(changes).length) return res.status(400).json({ error: "empty_request" });
  const changesErr = validateRequestChanges(changes);
  if (changesErr) return res.status(400).json({ error: changesErr });

  const t = now();
  const info = db
    .prepare("INSERT INTO profile_change_requests(player_id, proposed_changes, reason, status, created_at) VALUES(?,?,?,?,?)")
    .run(playerId, JSON.stringify(changes), reason || null, "pending", t);

  req.app.locals.io?.to("dm").emit("profile:requestCreated", { id: info.lastInsertRowid, playerId });
  res.json({ ok: true, requestId: info.lastInsertRowid });
});

profileRouter.get("/profile-requests", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const status = String(req.query.status || "").trim();
  const limitRaw = Number(req.query.limit ?? 200);
  const limit = Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? limitRaw : 200));
  const where = [];
  const args = [];
  if (status) {
    where.push("r.status = ?");
    args.push(status);
  }

  const rows = db
    .prepare(
      `
      SELECT r.id, r.player_id, r.proposed_changes, r.reason, r.status, r.created_at, r.resolved_at, r.resolved_by, r.dm_note,
             p.display_name as player_name
      FROM profile_change_requests r
      JOIN players p ON p.id = r.player_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY r.created_at DESC
      LIMIT ?
    `
    )
    .all(...args, limit)
    .map((r) => ({
      id: r.id,
      playerId: r.player_id,
      playerName: r.player_name,
      proposedChanges: jsonParse(r.proposed_changes, {}),
      reason: r.reason || "",
      status: r.status,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      resolvedBy: r.resolved_by,
      dmNote: r.dm_note || ""
    }));

  res.json({ items: rows });
});

profileRouter.get("/players/:id/profile-requests", (req, res) => {
  const playerId = Number(req.params.id);
  if (!playerId) return res.status(400).json({ error: "invalid_playerId" });

  const me = getPlayerContextFromRequest(req, { at: now() });
  if (!me || me.player.id !== playerId) return res.status(403).json({ error: "forbidden" });

  const status = String(req.query.status || "").trim();
  const limitRaw = Number(req.query.limit ?? 5);
  const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 5));

  const where = ["player_id = ?"];
  const args = [playerId];
  if (status) {
    where.push("status = ?");
    args.push(status);
  }

  const rows = getDb()
    .prepare(
      `
      SELECT id, proposed_changes, reason, status, created_at, resolved_at, resolved_by, dm_note
      FROM profile_change_requests
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT ?
    `
    )
    .all(...args, limit)
    .map((r) => ({
      id: r.id,
      proposedChanges: jsonParse(r.proposed_changes, {}),
      reason: r.reason || "",
      status: r.status,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      resolvedBy: r.resolved_by,
      dmNote: r.dm_note || ""
    }));

  res.json({ items: rows });
});

profileRouter.post("/profile-requests/:id/approve", dmAuthMiddleware, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid_request_id" });

  const db = getDb();
  const reqRow = db.prepare("SELECT * FROM profile_change_requests WHERE id=?").get(id);
  if (!reqRow) return res.status(404).json({ error: "not_found" });
  if (reqRow.status !== "pending") return res.status(409).json({ error: "already_resolved" });

  const note = String(req.body?.note || "").trim();
  const noteErr = validateTextLen(note, LIMITS.dmNote, "dm_note_too_long");
  if (noteErr) return res.status(400).json({ error: noteErr });

  const changes = jsonParse(reqRow.proposed_changes, {});
  const rawPatch = sanitizePatch(changes);
  const validated = validateAndFinalizePatch(rawPatch);
  if (validated.error) return res.status(400).json({ error: validated.error });
  const patch = validated.patch;
  const t = now();
  const resolvedBy = req.dm?.u ? `dm:${req.dm.u}` : req.dm?.uid ? `dm:${req.dm.uid}` : "dm";

  const tx = db.transaction(() => {
    const existing = db.prepare("SELECT * FROM character_profiles WHERE player_id=?").get(reqRow.player_id);
    if (!existing) {
      const base = buildProfilePayload({}, null);
      if (base?.error) throw new Error(base.error);
      const insertPayload = { ...base, ...patch, updated_at: t };
      db.prepare(
        `INSERT INTO character_profiles(
          player_id, character_name, class_role, level, stats, bio, avatar_url,
          editable_fields, allow_requests, created_by, created_at, updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        reqRow.player_id,
        insertPayload.character_name || "",
        insertPayload.class_role || "",
        insertPayload.level ?? null,
        insertPayload.stats || "{}",
        insertPayload.bio || "",
        insertPayload.avatar_url || "",
        base.editable_fields,
        base.allow_requests,
        resolvedBy,
        t,
        t
      );
    } else if (Object.keys(patch).length) {
      const sets = [];
      const args = [];
      for (const [k, v] of Object.entries(patch)) {
        sets.push(`${k}=?`);
        args.push(v);
      }
      sets.push("updated_at=?");
      args.push(t, reqRow.player_id);
      db.prepare(`UPDATE character_profiles SET ${sets.join(", ")} WHERE player_id=?`).run(...args);
    }

    db.prepare("UPDATE profile_change_requests SET status='approved', resolved_at=?, resolved_by=?, dm_note=? WHERE id=?")
      .run(t, resolvedBy, note || null, id);
  });

  try {
    tx();
  } catch (e) {
    return res.status(500).json({ error: "approve_failed", details: String(e?.message || e) });
  }

  req.app.locals.io?.to(`player:${reqRow.player_id}`).emit("profile:updated");
  req.app.locals.io?.to("dm").emit("players:updated");
  req.app.locals.io?.to("dm").emit("profile:requestsUpdated");
  res.json({ ok: true });
});

profileRouter.post("/profile-requests/:id/reject", dmAuthMiddleware, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid_request_id" });

  const db = getDb();
  const reqRow = db.prepare("SELECT * FROM profile_change_requests WHERE id=?").get(id);
  if (!reqRow) return res.status(404).json({ error: "not_found" });
  if (reqRow.status !== "pending") return res.status(409).json({ error: "already_resolved" });

  const note = String(req.body?.note || "").trim();
  const noteErr = validateTextLen(note, LIMITS.dmNote, "dm_note_too_long");
  if (noteErr) return res.status(400).json({ error: noteErr });

  const t = now();
  const resolvedBy = req.dm?.u ? `dm:${req.dm.u}` : req.dm?.uid ? `dm:${req.dm.uid}` : "dm";
  db.prepare("UPDATE profile_change_requests SET status='rejected', resolved_at=?, resolved_by=?, dm_note=? WHERE id=?")
    .run(t, resolvedBy, note || null, id);

  req.app.locals.io?.to("dm").emit("profile:requestsUpdated");
  res.json({ ok: true });
});
