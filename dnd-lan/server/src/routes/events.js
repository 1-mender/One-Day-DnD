import express from "express";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getParty } from "../db.js";
import { now } from "../util.js";

export const eventsRouter = express.Router();

function buildWhere(req, partyId) {
  const q = String(req.query.q ?? "").trim();
  const type = String(req.query.type ?? "").trim();
  const prefix = String(req.query.prefix ?? "").trim();
  const actorRole = String(req.query.actorRole ?? "").trim();
  const playerId = req.query.playerId != null ? Number(req.query.playerId) : null;
  const since = req.query.since != null ? Number(req.query.since) : null;

  const where = ["party_id = ?"];
  const args = [partyId];

  if (type) {
    where.push("type = ?");
    args.push(type);
  }
  if (prefix) {
    where.push("type LIKE ?");
    args.push(prefix + "%");
  }
  if (actorRole) {
    where.push("actor_role = ?");
    args.push(actorRole);
  }
  if (Number.isFinite(playerId) && playerId > 0) {
    where.push("actor_player_id = ?");
    args.push(playerId);
  }
  if (Number.isFinite(since) && since > 0) {
    where.push("created_at >= ?");
    args.push(since);
  }
  if (q) {
    where.push("(message LIKE ? OR type LIKE ? OR actor_name LIKE ?)");
    const like = `%${q}%`;
    args.push(like, like, like);
  }

  return { where, args, filters: { q, type, prefix, actorRole, playerId, since } };
}

eventsRouter.get("/export", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const partyId = getParty().id;

  const { where, args, filters } = buildWhere(req, partyId);
  const max = Math.max(1, Math.min(50000, Number(req.query.max ?? 20000)));

  const rows = db
    .prepare(
      `
      SELECT id, type, actor_role, actor_player_id, actor_name,
             target_type, target_id, message, data, created_at
      FROM events
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT ?
    `
    )
    .all(...args, max)
    .map((r) => {
      let parsed = {};
      try { parsed = JSON.parse(r.data || "{}"); } catch {}
      return { ...r, data: parsed };
    });

  const payload = {
    version: "events-export-v1",
    exportedAt: now(),
    partyId,
    filters,
    items: rows
  };

  const filename = `events_${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(JSON.stringify(payload, null, 2));
});

eventsRouter.get("/", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const partyId = getParty().id;

  const limitRaw = Number(req.query.limit ?? 200);
  const offsetRaw = Number(req.query.offset ?? 0);
  const limit = Math.max(1, Math.min(1000, Number.isFinite(limitRaw) ? limitRaw : 200));
  const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);

  const { where, args } = buildWhere(req, partyId);

  const sql = `
    SELECT id, type, actor_role, actor_player_id, actor_name,
           target_type, target_id, message, data, created_at
    FROM events
    WHERE ${where.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(sql).all(...args, limit, offset).map((r) => {
    let parsed = {};
    try { parsed = JSON.parse(r.data || "{}"); } catch {}
    return { ...r, data: parsed };
  });

  res.json({ items: rows, limit, offset, hasMore: rows.length === limit });
});

eventsRouter.post("/cleanup", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const partyId = getParty().id;

  const mode = String(req.body?.mode || "").trim();
  if (!mode) return res.status(400).json({ error: "mode_required" });

  let deleted = 0;

  if (mode === "all") {
    if (req.body?.confirm != null && String(req.body.confirm) !== "DELETE") {
      return res.status(400).json({ error: "confirm_required" });
    }
    const r = db.prepare("DELETE FROM events WHERE party_id=?").run(partyId);
    deleted = r.changes || 0;
    req.app.locals.io?.to("dm").emit("events:updated", { cleanup: true, mode: "all" });
    return res.json({ ok: true, mode, deleted });
  }

  if (mode === "olderThanDays") {
    const daysRaw = Number(req.body?.days);
    if (!Number.isFinite(daysRaw)) return res.status(400).json({ error: "days_required" });

    const days = Math.max(1, Math.min(3650, Math.floor(daysRaw)));
    const cutoff = now() - days * 24 * 60 * 60 * 1000;

    const r = db.prepare("DELETE FROM events WHERE party_id=? AND created_at < ?").run(partyId, cutoff);
    deleted = r.changes || 0;

    req.app.locals.io?.to("dm").emit("events:updated", { cleanup: true, mode: "olderThanDays", days });
    return res.json({ ok: true, mode, days, cutoff, deleted });
  }

  return res.status(400).json({ error: "bad_mode" });
});
