import express from "express";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getSinglePartyId } from "../db.js";
import { now, jsonParse } from "../util.js";
import { logEvent } from "../events.js";
import { getPlayerContextFromRequest, isDmRequest } from "../sessionAuth.js";
import { emitSinglePartyEvent } from "../singlePartyEmit.js";
import {
  infoBlockBodySchema,
  infoBlockIdParamsSchema,
  parseInfoBlocksRouteInput
} from "./infoBlocksRouteSchemas.js";
import { createRouteInputReader } from "./routeValidation.js";

export const infoBlocksRouter = express.Router();
const readValidInput = createRouteInputReader(parseInfoBlocksRouteInput);

function normalizeSelectedIds(db, partyId, selected) {
  const ids = Array.isArray(selected) ? selected.map(Number).filter((v) => Number.isFinite(v) && v > 0) : [];
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  return db.prepare(
    `SELECT id FROM players WHERE party_id=? AND id IN (${placeholders})`
  ).all(partyId, ...ids).map((r) => Number(r.id));
}

function validateSelectedAccess(access, selected) {
  if (access === "selected" && (!Array.isArray(selected) || !selected.length)) {
    return { error: "selected_players_required" };
  }
  return null;
}

infoBlocksRouter.get("/", (req, res) => {
  const db = getDb();
  const isDm = isDmRequest(req);
  if (isDm) {
    const partyId = getSinglePartyId();
    const items = db.prepare("SELECT * FROM info_blocks WHERE party_id=? ORDER BY updated_at DESC").all(partyId).map(mapBlock);
    return res.json({ items });
  }

  const me = getPlayerContextFromRequest(req, { at: now() });
  if (!me) return res.status(401).json({ error: "not_authenticated" });
  const partyId = Number(me.sess.party_id || 0);
  if (!partyId) return res.status(401).json({ error: "not_authenticated" });

  try {
    const rows = db.prepare(
      `SELECT * FROM info_blocks
       WHERE party_id=?
         AND (
          access='all'
          OR (access='selected' AND EXISTS (
            SELECT 1 FROM json_each(info_blocks.selected_player_ids) WHERE value=?
          ))
         )
       ORDER BY updated_at DESC`
    ).all(partyId, me.player.id);
    return res.json({ items: rows.map(mapBlock) });
  } catch {
    const all = db.prepare("SELECT * FROM info_blocks WHERE party_id=? ORDER BY updated_at DESC").all(partyId).map(mapBlock);
    const filtered = all.filter((b) => {
      if (b.access === "all") return true;
      if (b.access === "selected") return (b.selectedPlayerIds || []).includes(me.player.id);
      return false;
    });
    return res.json({ items: filtered });
  }
});

infoBlocksRouter.post("/", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const partyId = getSinglePartyId();
  const b = readValidInput(res, infoBlockBodySchema, req.body);
  if (!b) return;
  const title = String(b.title || "").trim();
  if (!title) return res.status(400).json({ error: "title_required" });

  const t = now();
  const access = ["dm", "all", "selected"].includes(b.access) ? b.access : "dm";
  const selected = normalizeSelectedIds(db, partyId, b.selectedPlayerIds);
  const selectedErr = validateSelectedAccess(access, selected);
  if (selectedErr) return res.status(400).json(selectedErr);
  const tags = Array.isArray(b.tags) ? b.tags.map(String) : [];

  const id = db.prepare(
    "INSERT INTO info_blocks(party_id, title, content, category, access, selected_player_ids, tags, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?)"
  ).run(
    partyId,
    title,
    String(b.content || ""),
    String(b.category || "note"),
    access,
    JSON.stringify(selected),
    JSON.stringify(tags),
    t, t
  ).lastInsertRowid;

  logEvent({
    partyId,
    type: "info.created",
    actorRole: "dm",
    actorName: "DM",
    targetType: "info_block",
    targetId: Number(id),
    message: `Info block created: ${title}`,
    io: req.app.locals.io
  });

  emitSinglePartyEvent(req.app.locals.io, "infoBlocks:updated", undefined, { partyId });
  res.json({ ok: true, id });
});

infoBlocksRouter.put("/:id", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const partyId = getSinglePartyId();
  const params = readValidInput(res, infoBlockIdParamsSchema, req.params, { status: 404, error: "not_found" });
  if (!params) return;
  const id = Number(params.id);
  const cur = db.prepare("SELECT * FROM info_blocks WHERE id=? AND party_id=?").get(id, partyId);
  if (!cur) return res.status(404).json({ error: "not_found" });

  const b = readValidInput(res, infoBlockBodySchema, req.body);
  if (!b) return;
  const title = String(b.title ?? cur.title).trim();
  if (!title) return res.status(400).json({ error: "title_required" });

  const access = ["dm", "all", "selected"].includes(b.access ?? cur.access) ? (b.access ?? cur.access) : "dm";
  const selected = Array.isArray(b.selectedPlayerIds)
    ? normalizeSelectedIds(db, partyId, b.selectedPlayerIds)
    : jsonParse(cur.selected_player_ids, []);
  const selectedErr = validateSelectedAccess(access, selected);
  if (selectedErr) return res.status(400).json(selectedErr);
  const tags = Array.isArray(b.tags) ? b.tags.map(String) : jsonParse(cur.tags, []);

  db.prepare(
    "UPDATE info_blocks SET title=?, content=?, category=?, access=?, selected_player_ids=?, tags=?, updated_at=? WHERE id=? AND party_id=?"
  ).run(
    title,
    String(b.content ?? cur.content ?? ""),
    String(b.category ?? cur.category ?? "note"),
    access,
    JSON.stringify(selected),
    JSON.stringify(tags),
    now(),
    id,
    partyId
  );

  logEvent({
    partyId,
    type: "info.updated",
    actorRole: "dm",
    actorName: "DM",
    targetType: "info_block",
    targetId: Number(id),
    message: `Info block updated: ${title}`,
    io: req.app.locals.io
  });

  emitSinglePartyEvent(req.app.locals.io, "infoBlocks:updated", undefined, { partyId });
  res.json({ ok: true });
});

infoBlocksRouter.delete("/:id", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const partyId = getSinglePartyId();
  const params = readValidInput(res, infoBlockIdParamsSchema, req.params, { status: 404, error: "not_found" });
  if (!params) return;
  const id = Number(params.id);
  const cur = db.prepare("SELECT title FROM info_blocks WHERE id=? AND party_id=?").get(id, partyId);
  if (!cur) return res.status(404).json({ error: "not_found" });
  db.prepare("DELETE FROM info_blocks WHERE id=? AND party_id=?").run(id, partyId);
  logEvent({
    partyId,
    type: "info.deleted",
    actorRole: "dm",
    actorName: "DM",
    targetType: "info_block",
    targetId: Number(id),
    message: `Info block deleted: ${cur?.title || id}`,
    io: req.app.locals.io
  });
  emitSinglePartyEvent(req.app.locals.io, "infoBlocks:updated", undefined, { partyId });
  res.json({ ok: true });
});

function mapBlock(r) {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    category: r.category,
    access: r.access,
    selectedPlayerIds: jsonParse(r.selected_player_ids, []),
    tags: jsonParse(r.tags, []),
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}
