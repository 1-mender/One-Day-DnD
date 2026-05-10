import express from "express";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getPartySettings, getSingleParty, setPartySettings } from "../db.js";
import {
  buildProfilePayload,
  DEFAULT_PRESET_ACCESS,
  EDITABLE_FIELDS,
  LIMITS,
  mapPublicProfile,
  mapProfile,
  normalizeEditableFields,
  normalizePresetAccess,
  PRESET_LIMITS,
  sanitizePatch,
  sanitizePreset,
  sanitizeRequestChanges,
  validateAndFinalizePatch,
  validatePlayerClassPathPatch,
  validateRequestChanges,
  validateTextLen
} from "../profile/profileDomain.js";
import { emitSinglePartyEvent } from "../singlePartyEmit.js";
import { jsonParse, now } from "../util.js";
import { ensureSessionWritable, getDmPayloadFromRequest, getPlayerContextFromRequest } from "../sessionAuth.js";
import {
  dmProfilePresetsBodySchema,
  parseProfileRouteInput,
  playerIdParamsSchema,
  playerProfileRequestCreateBodySchema,
  profilePatchBodySchema,
  profileRequestIdParamsSchema,
  profileRequestResolutionBodySchema,
  profileRequestsQuerySchema,
  profileUpsertBodySchema,
  profileXpAwardBodySchema
} from "./profileRouteSchemas.js";
import { createRouteInputReader } from "./routeValidation.js";

export const profileRouter = express.Router();

const readValidInput = createRouteInputReader(parseProfileRouteInput);
const PLAYER_PUBLIC_PROFILE_FIELDS = new Set(["publicFields", "publicBlurb"]);
const PLAYER_CLASS_PATH_FIELDS = new Set(["classKey", "specializationKey"]);
const XP_LOG_LIMIT = 10;
const XP_AWARD_LIMIT = 1000;

function getDmActor(req) {
  return req.dm?.u ? `dm:${req.dm.u}` : req.dm?.uid ? `dm:${req.dm.uid}` : "dm";
}

function normalizeXpAwardAmount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const amount = Math.round(numeric);
  if (amount === 0 || Math.abs(amount) > XP_AWARD_LIMIT) return null;
  return amount;
}

function readXpLog(db, playerId, limit = XP_LOG_LIMIT) {
  return db
    .prepare(
      `SELECT id, amount, reason, actor, created_at
       FROM character_profile_xp_log
       WHERE player_id=?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    )
    .all(playerId, limit)
    .map((row) => ({
      id: row.id,
      amount: Number(row.amount || 0),
      reason: row.reason || "",
      actor: row.actor || "",
      createdAt: row.created_at
    }));
}

function mapProfileWithXpLog(db, row) {
  if (!row) return null;
  return {
    ...mapProfile(row),
    xpLog: readXpLog(db, row.player_id)
  };
}

profileRouter.get("/profile-presets", (req, res) => {
  const dm = getDmPayloadFromRequest(req);
  const me = getPlayerContextFromRequest(req, { at: now() });
  if (!dm && !me) return res.status(403).json({ error: "forbidden" });

  const party = getSingleParty();
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
  const party = getSingleParty();
  const settings = getPartySettings(party.id);
  const presets = jsonParse(settings.profile_presets, []);
  const access = normalizePresetAccess(jsonParse(settings.profile_presets_access, {}));
  res.json({ presets: Array.isArray(presets) ? presets : [], access });
});

profileRouter.put("/profile-presets/dm", dmAuthMiddleware, (req, res) => {
  const body = readValidInput(res, dmProfilePresetsBodySchema, req.body);
  if (!body) return;
  const party = getSingleParty();

  if (body.reset) {
    setPartySettings(party.id, {
      profile_presets: "[]",
      profile_presets_access: JSON.stringify(DEFAULT_PRESET_ACCESS)
    });
    emitSinglePartyEvent(req.app.locals.io, "settings:updated", undefined, { partyId: party.id });
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
  emitSinglePartyEvent(req.app.locals.io, "settings:updated", undefined, { partyId: party.id });
  res.json({ presets, access });
});

profileRouter.get("/players/:id/profile", (req, res) => {
  const params = readValidInput(res, playerIdParamsSchema, req.params, { error: "invalid_playerId" });
  if (!params) return;
  const playerId = Number(params.id);

  const dm = getDmPayloadFromRequest(req);
  const me = getPlayerContextFromRequest(req, { at: now() });
  if (!dm && (!me || me.player.id !== playerId)) return res.status(403).json({ error: "forbidden" });

  const db = getDb();
  const row = db.prepare("SELECT * FROM character_profiles WHERE player_id=?").get(playerId);
  if (!row) return res.json({ notCreated: true });
  return res.json({ profile: mapProfileWithXpLog(db, row) });
});

profileRouter.get("/players/:id/public-profile", (req, res) => {
  const params = readValidInput(res, playerIdParamsSchema, req.params, { error: "invalid_playerId" });
  if (!params) return;
  const playerId = Number(params.id);

  const dm = getDmPayloadFromRequest(req);
  const me = getPlayerContextFromRequest(req, { at: now() });
  if (!dm && !me) return res.status(403).json({ error: "forbidden" });

  const db = getDb();
  const player = db.prepare("SELECT id, display_name as displayName, status, last_seen as lastSeen FROM players WHERE id=? AND banned=0").get(playerId);
  if (!player) return res.status(404).json({ error: "not_found" });

  const row = db.prepare("SELECT * FROM character_profiles WHERE player_id=?").get(playerId);
  if (!row) return res.json({ notCreated: true, profile: null });
  return res.json({ profile: mapPublicProfile(row) });
});

profileRouter.put("/players/:id/profile", dmAuthMiddleware, (req, res) => {
  const params = readValidInput(res, playerIdParamsSchema, req.params, { error: "invalid_playerId" });
  if (!params) return;
  const body = readValidInput(res, profileUpsertBodySchema, req.body);
  if (!body) return;
  const playerId = Number(params.id);

  const db = getDb();
  const player = db.prepare("SELECT id FROM players WHERE id=?").get(playerId);
  if (!player) return res.status(404).json({ error: "player_not_found" });
  const existing = db.prepare("SELECT * FROM character_profiles WHERE player_id=?").get(playerId);
  const payload = buildProfilePayload(body, existing);
  if (payload?.error) return res.status(400).json({ error: payload.error });
  const t = now();

  if (existing) {
    db.prepare(
      `UPDATE character_profiles
       SET character_name=?, class_role=?, level=?, reputation=?, class_key=?, specialization_key=?, xp=?, stats=?, bio=?, avatar_url=?,
           public_fields=?, public_blurb=?, editable_fields=?, allow_requests=?, updated_at=?
       WHERE player_id=?`
    ).run(
      payload.character_name,
      payload.class_role,
      payload.level,
      payload.reputation,
      payload.class_key,
      payload.specialization_key,
      payload.xp,
      payload.stats,
      payload.bio,
      payload.avatar_url,
      payload.public_fields,
      payload.public_blurb,
      payload.editable_fields,
      payload.allow_requests,
      t,
      playerId
    );
  } else {
    const createdBy = req.dm?.u ? `dm:${req.dm.u}` : req.dm?.uid ? `dm:${req.dm.uid}` : "dm";
    db.prepare(
      `INSERT INTO character_profiles(
        player_id, character_name, class_role, level, reputation, class_key, specialization_key, xp, stats, bio, avatar_url,
        public_fields, public_blurb, editable_fields, allow_requests, created_by, created_at, updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      playerId,
      payload.character_name,
      payload.class_role,
      payload.level,
      payload.reputation,
      payload.class_key,
      payload.specialization_key,
      payload.xp,
      payload.stats,
      payload.bio,
      payload.avatar_url,
      payload.public_fields,
      payload.public_blurb,
      payload.editable_fields,
      payload.allow_requests,
      createdBy,
      t,
      t
    );
  }

  const row = db.prepare("SELECT * FROM character_profiles WHERE player_id=?").get(playerId);
  req.app.locals.io?.to(`player:${playerId}`).emit("profile:updated");
  emitSinglePartyEvent(req.app.locals.io, "players:updated");
  res.json({ ok: true, profile: mapProfileWithXpLog(db, row) });
});

profileRouter.post("/players/:id/profile/xp", dmAuthMiddleware, (req, res) => {
  const params = readValidInput(res, playerIdParamsSchema, req.params, { error: "invalid_playerId" });
  if (!params) return;
  const body = readValidInput(res, profileXpAwardBodySchema, req.body);
  if (!body) return;
  const playerId = Number(params.id);
  const amount = normalizeXpAwardAmount(body.amount);
  if (amount == null) return res.status(400).json({ error: "invalid_xp_amount" });
  const reason = String(body.reason || "").trim();
  const reasonErr = validateTextLen(reason, LIMITS.xpReason, "xp_reason_too_long");
  if (reasonErr) return res.status(400).json({ error: reasonErr });

  const db = getDb();
  const player = db.prepare("SELECT id FROM players WHERE id=?").get(playerId);
  if (!player) return res.status(404).json({ error: "player_not_found" });
  const row = db.prepare("SELECT * FROM character_profiles WHERE player_id=?").get(playerId);
  if (!row) return res.status(404).json({ error: "profile_not_created" });

  const currentXp = Math.max(0, Math.round(Number(row.xp || 0)));
  const nextXp = Math.max(0, currentXp + amount);
  const appliedAmount = nextXp - currentXp;
  if (appliedAmount === 0) return res.status(400).json({ error: "xp_no_change" });

  const t = now();
  const actor = getDmActor(req);
  const tx = db.transaction(() => {
    db.prepare("UPDATE character_profiles SET xp=?, updated_at=? WHERE player_id=?").run(nextXp, t, playerId);
    db.prepare(
      "INSERT INTO character_profile_xp_log(player_id, amount, reason, actor, created_at) VALUES(?,?,?,?,?)"
    ).run(playerId, appliedAmount, reason || null, actor, t);
  });
  tx();

  req.app.locals.io?.to(`player:${playerId}`).emit("profile:updated");
  emitSinglePartyEvent(req.app.locals.io, "players:updated");
  const updated = db.prepare("SELECT * FROM character_profiles WHERE player_id=?").get(playerId);
  res.json({ ok: true, profile: mapProfileWithXpLog(db, updated) });
});

profileRouter.patch("/players/:id/profile", (req, res) => {
  const params = readValidInput(res, playerIdParamsSchema, req.params, { error: "invalid_playerId" });
  if (!params) return;
  const body = readValidInput(res, profilePatchBodySchema, req.body);
  if (!body) return;
  const playerId = Number(params.id);

  const me = getPlayerContextFromRequest(req, { at: now() });
  if (!me || me.player.id !== playerId) return res.status(403).json({ error: "forbidden" });
  if (!ensureSessionWritable(me.sess, res)) return;

  const db = getDb();
  const row = db.prepare("SELECT * FROM character_profiles WHERE player_id=?").get(playerId);
  if (!row) return res.status(404).json({ error: "profile_not_created" });

  const editableFields = normalizeEditableFields(jsonParse(row.editable_fields, []));
  const bodyKeys = Object.keys(body);
  if (!bodyKeys.length) return res.status(400).json({ error: "empty_patch" });
  for (const key of bodyKeys) {
    if (PLAYER_PUBLIC_PROFILE_FIELDS.has(key)) continue;
    if (PLAYER_CLASS_PATH_FIELDS.has(key)) continue;
    if (!EDITABLE_FIELDS.has(key)) return res.status(403).json({ error: "field_not_allowed", field: key });
  }

  for (const key of bodyKeys) {
    if (PLAYER_PUBLIC_PROFILE_FIELDS.has(key)) continue;
    if (PLAYER_CLASS_PATH_FIELDS.has(key)) continue;
    if (!editableFields.includes(key)) return res.status(403).json({ error: "field_not_allowed", field: key });
  }

  const classPathError = validatePlayerClassPathPatch(body, row);
  if (classPathError) return res.status(400).json({ error: classPathError });

  const rawPatch = sanitizePatch(body, row);
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
  emitSinglePartyEvent(req.app.locals.io, "players:updated");
  const updated = db.prepare("SELECT * FROM character_profiles WHERE player_id=?").get(playerId);
  res.json({ ok: true, profile: mapProfileWithXpLog(db, updated) });
});

profileRouter.post("/players/:id/profile-requests", (req, res) => {
  const params = readValidInput(res, playerIdParamsSchema, req.params, { error: "invalid_playerId" });
  if (!params) return;
  const body = readValidInput(res, playerProfileRequestCreateBodySchema, req.body);
  if (!body) return;
  const playerId = Number(params.id);

  const me = getPlayerContextFromRequest(req, { at: now() });
  if (!me || me.player.id !== playerId) return res.status(403).json({ error: "forbidden" });
  if (!ensureSessionWritable(me.sess, res)) return;

  const db = getDb();
  const profile = db.prepare("SELECT allow_requests FROM character_profiles WHERE player_id=?").get(playerId);
  if (!profile) return res.status(404).json({ error: "profile_not_created" });
  if (!profile.allow_requests) return res.status(403).json({ error: "requests_disabled" });

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

  req.app.locals.io?.to(`player:${playerId}`).emit("profile:requestsUpdated", {
    requestId: Number(info.lastInsertRowid),
    playerId
  });
  req.app.locals.io?.to("dm").emit("profile:requestCreated", { id: info.lastInsertRowid, playerId });
  res.json({ ok: true, requestId: info.lastInsertRowid });
});

profileRouter.get("/profile-requests", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const query = readValidInput(res, profileRequestsQuerySchema, req.query);
  if (!query) return;
  const status = String(query.status || "").trim();
  const limitRaw = Number(query.limit ?? 200);
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
  const params = readValidInput(res, playerIdParamsSchema, req.params, { error: "invalid_playerId" });
  if (!params) return;
  const query = readValidInput(res, profileRequestsQuerySchema, req.query);
  if (!query) return;
  const playerId = Number(params.id);

  const me = getPlayerContextFromRequest(req, { at: now() });
  if (!me || me.player.id !== playerId) return res.status(403).json({ error: "forbidden" });

  const status = String(query.status || "").trim();
  const limitRaw = Number(query.limit ?? 5);
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
  const params = readValidInput(res, profileRequestIdParamsSchema, req.params, { error: "invalid_request_id" });
  if (!params) return;
  const body = readValidInput(res, profileRequestResolutionBodySchema, req.body);
  if (!body) return;
  const id = Number(params.id);

  const db = getDb();
  const reqRow = db.prepare("SELECT * FROM profile_change_requests WHERE id=?").get(id);
  if (!reqRow) return res.status(404).json({ error: "not_found" });
  if (reqRow.status !== "pending") return res.status(409).json({ error: "already_resolved" });

  const note = String(body.note || "").trim();
  const noteErr = validateTextLen(note, LIMITS.dmNote, "dm_note_too_long");
  if (noteErr) return res.status(400).json({ error: noteErr });

  const changes = jsonParse(reqRow.proposed_changes, {});
  const existingForPatch = db.prepare("SELECT * FROM character_profiles WHERE player_id=?").get(reqRow.player_id);
  const rawPatch = sanitizePatch(changes, existingForPatch);
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
          player_id, character_name, class_role, level, reputation, class_key, specialization_key, xp, stats, bio, avatar_url,
          public_fields, public_blurb, editable_fields, allow_requests, created_by, created_at, updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        reqRow.player_id,
        insertPayload.character_name || "",
        insertPayload.class_role || "",
        insertPayload.level ?? null,
        insertPayload.reputation ?? 0,
        insertPayload.class_key || "",
        insertPayload.specialization_key || "",
        insertPayload.xp ?? 0,
        insertPayload.stats || "{}",
        insertPayload.bio || "",
        insertPayload.avatar_url || "",
        insertPayload.public_fields || "[]",
        insertPayload.public_blurb || "",
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
  req.app.locals.io?.to(`player:${reqRow.player_id}`).emit("profile:requestsUpdated", {
    requestId: id,
    playerId: Number(reqRow.player_id),
    status: "approved"
  });
  emitSinglePartyEvent(req.app.locals.io, "players:updated");
  req.app.locals.io?.to("dm").emit("profile:requestsUpdated");
  res.json({ ok: true });
});

profileRouter.post("/profile-requests/:id/reject", dmAuthMiddleware, (req, res) => {
  const params = readValidInput(res, profileRequestIdParamsSchema, req.params, { error: "invalid_request_id" });
  if (!params) return;
  const body = readValidInput(res, profileRequestResolutionBodySchema, req.body);
  if (!body) return;
  const id = Number(params.id);

  const db = getDb();
  const reqRow = db.prepare("SELECT * FROM profile_change_requests WHERE id=?").get(id);
  if (!reqRow) return res.status(404).json({ error: "not_found" });
  if (reqRow.status !== "pending") return res.status(409).json({ error: "already_resolved" });

  const note = String(body.note || "").trim();
  const noteErr = validateTextLen(note, LIMITS.dmNote, "dm_note_too_long");
  if (noteErr) return res.status(400).json({ error: noteErr });

  const t = now();
  const resolvedBy = req.dm?.u ? `dm:${req.dm.u}` : req.dm?.uid ? `dm:${req.dm.uid}` : "dm";
  db.prepare("UPDATE profile_change_requests SET status='rejected', resolved_at=?, resolved_by=?, dm_note=? WHERE id=?")
    .run(t, resolvedBy, note || null, id);

  req.app.locals.io?.to(`player:${reqRow.player_id}`).emit("profile:requestsUpdated", {
    requestId: id,
    playerId: Number(reqRow.player_id),
    status: "rejected"
  });
  req.app.locals.io?.to("dm").emit("profile:requestsUpdated");
  res.json({ ok: true });
});
