import express from "express";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getSinglePartyId } from "../db.js";
import { now } from "../util.js";
import { getActiveSessionByToken, getPlayerTokenFromRequest } from "../sessionAuth.js";
import {
  listInventoryForPlayer,
  processDmInventoryBulkDelete,
  processDmInventoryBulkVisibility,
  processDmInventoryCreate,
  processDmInventoryDelete,
  processDmInventoryUpdate,
  processPlayerInventoryCreate,
  processPlayerInventoryDelete,
  processPlayerInventoryUpdate
} from "../inventory/services/inventoryCrudService.js";
import {
  processInventoryLayoutUpdate,
  processInventoryQuickEquip,
  processInventorySplit
} from "../inventory/services/inventoryLayoutService.js";
import {
  listDmTransfers,
  listTransferInbox,
  listTransferOutbox,
  processDmTransferCancel,
  processTransferAccept,
  processTransferCancel,
  processTransferCreate,
  processTransferReject
} from "../inventory/services/inventoryTransferService.js";

export const inventoryRouter = express.Router();

function authPlayer(req) {
  const token = getPlayerTokenFromRequest(req);
  if (!token) return null;
  return getActiveSessionByToken(token, { at: now() });
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
  const result = listInventoryForPlayer({ db: getDb(), playerId: sess.player_id, includeWeightLimit: true });
  return res.status(result.status).json(result.body);
});

inventoryRouter.get("/player/:playerId", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  const result = listInventoryForPlayer({ db: getDb(), playerId: pid, includeWeightLimit: false });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/mine", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const result = processPlayerInventoryCreate({ db: getDb(), io: req.app.locals.io, sess, body: req.body });
  return res.status(result.status).json(result.body);
});

inventoryRouter.put("/mine/:id", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const itemId = Number(req.params.id);
  const result = processPlayerInventoryUpdate({ db: getDb(), io: req.app.locals.io, sess, itemId, body: req.body });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/mine/layout", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const result = processInventoryLayoutUpdate({ db: getDb(), io: req.app.locals.io, sess, body: req.body });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/mine/:id/split", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const result = processInventorySplit({
    db: getDb(),
    io: req.app.locals.io,
    sess,
    itemId: req.params.id,
    body: req.body
  });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/mine/:id/quick-equip", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const result = processInventoryQuickEquip({
    db: getDb(),
    io: req.app.locals.io,
    sess,
    itemId: req.params.id
  });
  return res.status(result.status).json(result.body);
});

inventoryRouter.delete("/mine/:id", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const itemId = Number(req.params.id);
  const result = processPlayerInventoryDelete({ db: getDb(), io: req.app.locals.io, sess, itemId });
  return res.status(result.status).json(result.body);
});

// DM edit any inventory
inventoryRouter.post("/dm/player/:playerId", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  if (!pid) return res.status(400).json({ error: "invalid_playerId" });
  const result = processDmInventoryCreate({ db: getDb(), io: req.app.locals.io, playerId: pid, body: req.body });
  return res.status(result.status).json(result.body);
});

// DM update any inventory item
inventoryRouter.put("/dm/player/:playerId/:id", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  const itemId = Number(req.params.id);
  if (!pid || !itemId) return res.status(400).json({ error: "invalid_id" });
  const result = processDmInventoryUpdate({
    db: getDb(),
    io: req.app.locals.io,
    playerId: pid,
    itemId,
    body: req.body,
    fallbackPartyId: getSinglePartyId()
  });
  return res.status(result.status).json(result.body);
});

// DM delete any inventory item
inventoryRouter.delete("/dm/player/:playerId/:id", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  const itemId = Number(req.params.id);
  if (!pid || !itemId) return res.status(400).json({ error: "invalid_id" });
  const result = processDmInventoryDelete({
    db: getDb(),
    io: req.app.locals.io,
    playerId: pid,
    itemId,
    fallbackPartyId: getSinglePartyId()
  });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/dm/player/:playerId/bulk-visibility", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  if (!pid) return res.status(400).json({ error: "invalid_playerId" });
  const result = processDmInventoryBulkVisibility({ db: getDb(), io: req.app.locals.io, playerId: pid, body: req.body });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/dm/player/:playerId/bulk-delete", dmAuthMiddleware, (req, res) => {
  const pid = Number(req.params.playerId);
  if (!pid) return res.status(400).json({ error: "invalid_playerId" });
  const result = processDmInventoryBulkDelete({ db: getDb(), io: req.app.locals.io, playerId: pid, body: req.body });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/transfers", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const result = processTransferCreate({ db: getDb(), io: req.app.locals.io, sess, body: req.body, nowFn: now });
  return res.status(result.status).json(result.body);
});

inventoryRouter.get("/transfers/inbox", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  const result = listTransferInbox({ db: getDb(), playerId: sess.player_id, nowFn: now });
  return res.status(result.status).json(result.body);
});

inventoryRouter.get("/transfers/outbox", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  const result = listTransferOutbox({ db: getDb(), playerId: sess.player_id, nowFn: now });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/transfers/:id/accept", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const result = processTransferAccept({
    db: getDb(),
    io: req.app.locals.io,
    sess,
    transferId: req.params.id,
    nowFn: now
  });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/transfers/:id/reject", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const result = processTransferReject({
    db: getDb(),
    io: req.app.locals.io,
    sess,
    transferId: req.params.id,
    nowFn: now
  });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/transfers/:id/cancel", (req, res) => {
  const sess = authPlayer(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (!ensureWritable(sess, res)) return;
  const result = processTransferCancel({
    db: getDb(),
    io: req.app.locals.io,
    sess,
    transferId: req.params.id,
    nowFn: now
  });
  return res.status(result.status).json(result.body);
});

inventoryRouter.get("/transfers/dm", dmAuthMiddleware, (req, res) => {
  const status = String(req.query?.status || "pending");
  const result = listDmTransfers({ db: getDb(), status });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/transfers/:id/dm/cancel", dmAuthMiddleware, (req, res) => {
  const result = processDmTransferCancel({
    db: getDb(),
    io: req.app.locals.io,
    transferId: req.params.id,
    nowFn: now
  });
  return res.status(result.status).json(result.body);
});
