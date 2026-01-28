import express from "express";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getParty } from "../db.js";
import { now } from "../util.js";
import { logEvent } from "../events.js";

export const inventoryRouter = express.Router();

function authPlayer(req) {
  const token = req.header("x-player-token");
  if (!token) return null;
  const db = getDb();
  const sess = db.prepare("SELECT * FROM sessions WHERE token=? AND revoked=0 AND expires_at>?").get(String(token), now());
  if (!sess) return null;
  return sess;
}

function ensureWritable(sess, res) {
  if (sess.impersonated && !sess.impersonated_write) {
    res.status(403).json({ error: "read_only_impersonation" });
    return false;
  }
  return true;
}

inventoryRouter.get("/mine", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  const db = getDb();
  const items = db.prepare("SELECT * FROM inventory_items WHERE player_id=? ORDER BY id DESC").all(sess.player_id)
    .map((r) => ({
      ...r,
      tags: JSON.parse(r.tags || "[]")
    }));
  res.json({ items });
});

inventoryRouter.get("/player/:playerId", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  const db = getDb();
  const items = db.prepare("SELECT * FROM inventory_items WHERE player_id=? ORDER BY id DESC").all(pid)
    .map((r) => ({ ...r, tags: JSON.parse(r.tags || "[]") }));
  res.json({ items });
});

inventoryRouter.post("/mine", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const db = getDb();
  const b = req.body || {};
  const name = String(b.name || "").trim();
  if (!name) return res.status(400).json({ error: "name_required" });

  const qty = Math.max(1, Number(b.qty || 1));
  const weight = Math.max(0, Number(b.weight || 0));
  const rarity = String(b.rarity || "common");
  const visibility = (b.visibility === "hidden") ? "hidden" : "public";
  const tags = Array.isArray(b.tags) ? b.tags.map(String) : [];
  const desc = String(b.description || "");

  const t = now();
  const id = db.prepare(
    "INSERT INTO inventory_items(player_id, name, description, qty, weight, rarity, tags, visibility, updated_at, updated_by) VALUES(?,?,?,?,?,?,?,?,?,?)"
  ).run(
    sess.player_id,
    name,
    desc,
    qty,
    weight,
    rarity,
    JSON.stringify(tags),
    visibility,
    t,
    sess.impersonated ? "dm" : "player"
  ).lastInsertRowid;

  logEvent({
    partyId: sess.party_id,
    type: "inventory.created",
    actorRole: sess.impersonated ? "dm" : "player",
    actorPlayerId: sess.player_id,
    actorName: sess.impersonated ? "DM (impersonation)" : null,
    targetType: "inventory_item",
    targetId: Number(id),
    message: `Добавлен предмет: ${name}`,
    data: { playerId: sess.player_id, visibility, qty },
    io: req.app.locals.io
  });

  req.app.locals.io?.to(`player:${sess.player_id}`).emit("inventory:updated");
  req.app.locals.io?.to("dm").emit("inventory:updated");
  res.json({ ok: true, id });
});

inventoryRouter.put("/mine/:id", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const db = getDb();
  const itemId = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM inventory_items WHERE id=? AND player_id=?").get(itemId, sess.player_id);
  if (!existing) return res.status(404).json({ error: "not_found" });

  const b = req.body || {};
  const name = String(b.name ?? existing.name).trim();
  if (!name) return res.status(400).json({ error: "name_required" });

  const qty = Math.max(1, Number(b.qty ?? existing.qty));
  const weight = Math.max(0, Number(b.weight ?? existing.weight));
  const rarity = String(b.rarity ?? existing.rarity);
  const visibility = (b.visibility ?? existing.visibility) === "hidden" ? "hidden" : "public";
  const tags = Array.isArray(b.tags) ? b.tags.map(String) : JSON.parse(existing.tags || "[]");
  const desc = String(b.description ?? existing.description ?? "");

  db.prepare("UPDATE inventory_items SET name=?, description=?, qty=?, weight=?, rarity=?, tags=?, visibility=?, updated_at=?, updated_by=? WHERE id=?")
    .run(name, desc, qty, weight, rarity, JSON.stringify(tags), visibility, now(), sess.impersonated ? "dm" : "player", itemId);

  logEvent({
    partyId: sess.party_id,
    type: "inventory.updated",
    actorRole: sess.impersonated ? "dm" : "player",
    actorPlayerId: sess.player_id,
    actorName: sess.impersonated ? "DM (impersonation)" : null,
    targetType: "inventory_item",
    targetId: Number(itemId),
    message: `Изменён предмет: ${name}`,
    data: { playerId: sess.player_id, visibility, qty },
    io: req.app.locals.io
  });

  req.app.locals.io?.to(`player:${sess.player_id}`).emit("inventory:updated");
  req.app.locals.io?.to("dm").emit("inventory:updated");
  res.json({ ok: true });
});

inventoryRouter.delete("/mine/:id", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const db = getDb();
  const itemId = Number(req.params.id);
  const row = db.prepare("SELECT name FROM inventory_items WHERE id=? AND player_id=?").get(itemId, sess.player_id);
  db.prepare("DELETE FROM inventory_items WHERE id=? AND player_id=?").run(itemId, sess.player_id);

  logEvent({
    partyId: sess.party_id,
    type: "inventory.deleted",
    actorRole: sess.impersonated ? "dm" : "player",
    actorPlayerId: sess.player_id,
    actorName: sess.impersonated ? "DM (impersonation)" : null,
    targetType: "inventory_item",
    targetId: Number(itemId),
    message: `Удалён предмет: ${row?.name || itemId}`,
    data: { playerId: sess.player_id },
    io: req.app.locals.io
  });

  req.app.locals.io?.to(`player:${sess.player_id}`).emit("inventory:updated");
  req.app.locals.io?.to("dm").emit("inventory:updated");
  res.json({ ok: true });
});

// DM edit any inventory
inventoryRouter.post("/dm/player/:playerId", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  const db = getDb();
  const b = req.body || {};
  const name = String(b.name || "").trim();
  if (!name) return res.status(400).json({ error: "name_required" });

  const qty = Math.max(1, Number(b.qty || 1));
  const weight = Math.max(0, Number(b.weight || 0));
  const rarity = String(b.rarity || "common");
  const visibility = (b.visibility === "hidden") ? "hidden" : "public";
  const tags = Array.isArray(b.tags) ? b.tags.map(String) : [];
  const desc = String(b.description || "");

  const ins2 = db.prepare(
    "INSERT INTO inventory_items(player_id, name, description, qty, weight, rarity, tags, visibility, updated_at, updated_by) VALUES(?,?,?,?,?,?,?,?,?,?)"
  ).run(pid, name, desc, qty, weight, rarity, JSON.stringify(tags), visibility, now(), "dm");

  const p = db.prepare("SELECT party_id FROM players WHERE id=?").get(pid);
  logEvent({
    partyId: p?.party_id ?? getParty().id,
    type: "inventory.granted",
    actorRole: "dm",
    actorName: "DM",
    targetType: "inventory_item",
    targetId: Number(ins2.lastInsertRowid),
    message: `DM выдал предмет "${name}" игроку #${pid}`,
    data: { playerId: pid, visibility, qty },
    io: req.app.locals.io
  });

  req.app.locals.io?.to(`player:${pid}`).emit("inventory:updated");
  req.app.locals.io?.to("dm").emit("inventory:updated");
  res.json({ ok: true });
});
