import express from "express";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getSinglePartyId } from "../db.js";
import { now } from "../util.js";
import { requirePlayerSession } from "../sessionAuth.js";
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
import {
  dmBulkDeleteBodySchema,
  dmBulkVisibilityBodySchema,
  dmItemParamsSchema,
  dmTransfersQuerySchema,
  emptyBodySchema,
  inventoryItemBodySchema,
  inventoryLayoutBodySchema,
  inventorySplitBodySchema,
  itemIdParamsSchema,
  parseInventoryRouteInput,
  playerIdParamsSchema,
  transferCreateBodySchema,
  transferIdParamsSchema
} from "./inventoryRouteSchemas.js";
import { createRouteInputReader } from "./routeValidation.js";

export const inventoryRouter = express.Router();

const readValidInput = createRouteInputReader(parseInventoryRouteInput);

inventoryRouter.get("/mine", (req, res) => {
  const sess = requirePlayerSession(req, res, { at: now() });
  if (!sess) return;
  const result = listInventoryForPlayer({ db: getDb(), playerId: sess.player_id, includeWeightLimit: true });
  return res.status(result.status).json(result.body);
});

inventoryRouter.get("/player/:playerId", dmAuthMiddleware, (req, res) => {
  const params = readValidInput(res, playerIdParamsSchema, req.params, { error: "invalid_playerId" });
  if (!params) return;
  const result = listInventoryForPlayer({ db: getDb(), playerId: params.playerId, includeWeightLimit: false });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/mine", (req, res) => {
  const sess = requirePlayerSession(req, res, { at: now(), writable: true });
  if (!sess) return;
  const body = readValidInput(res, inventoryItemBodySchema, req.body);
  if (!body) return;
  const result = processPlayerInventoryCreate({ db: getDb(), io: req.app.locals.io, sess, body });
  return res.status(result.status).json(result.body);
});

inventoryRouter.put("/mine/:id", (req, res) => {
  const sess = requirePlayerSession(req, res, { at: now(), writable: true });
  if (!sess) return;
  const params = readValidInput(res, itemIdParamsSchema, req.params, { error: "invalid_id" });
  if (!params) return;
  const body = readValidInput(res, inventoryItemBodySchema, req.body);
  if (!body) return;
  const result = processPlayerInventoryUpdate({
    db: getDb(),
    io: req.app.locals.io,
    sess,
    itemId: params.id,
    body
  });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/mine/layout", (req, res) => {
  const sess = requirePlayerSession(req, res, { at: now(), writable: true });
  if (!sess) return;
  const body = readValidInput(res, inventoryLayoutBodySchema, req.body);
  if (!body) return;
  const result = processInventoryLayoutUpdate({ db: getDb(), io: req.app.locals.io, sess, body });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/mine/:id/split", (req, res) => {
  const sess = requirePlayerSession(req, res, { at: now(), writable: true });
  if (!sess) return;
  const params = readValidInput(res, itemIdParamsSchema, req.params, { error: "invalid_id" });
  if (!params) return;
  const body = readValidInput(res, inventorySplitBodySchema, req.body);
  if (!body) return;
  const result = processInventorySplit({
    db: getDb(),
    io: req.app.locals.io,
    sess,
    itemId: params.id,
    body
  });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/mine/:id/quick-equip", (req, res) => {
  const sess = requirePlayerSession(req, res, { at: now(), writable: true });
  if (!sess) return;
  const params = readValidInput(res, itemIdParamsSchema, req.params, { error: "invalid_id" });
  if (!params) return;
  const body = readValidInput(res, emptyBodySchema, req.body);
  if (!body) return;
  const result = processInventoryQuickEquip({
    db: getDb(),
    io: req.app.locals.io,
    sess,
    itemId: params.id
  });
  return res.status(result.status).json(result.body);
});

inventoryRouter.delete("/mine/:id", (req, res) => {
  const sess = requirePlayerSession(req, res, { at: now(), writable: true });
  if (!sess) return;
  const params = readValidInput(res, itemIdParamsSchema, req.params, "invalid_id");
  if (!params) return;
  const result = processPlayerInventoryDelete({ db: getDb(), io: req.app.locals.io, sess, itemId: params.id });
  return res.status(result.status).json(result.body);
});

// DM edit any inventory
inventoryRouter.post("/dm/player/:playerId", dmAuthMiddleware, (req, res) => {
  const params = readValidInput(res, playerIdParamsSchema, req.params, { error: "invalid_playerId" });
  if (!params) return;
  const body = readValidInput(res, inventoryItemBodySchema, req.body);
  if (!body) return;
  const result = processDmInventoryCreate({
    db: getDb(),
    io: req.app.locals.io,
    playerId: params.playerId,
    body
  });
  return res.status(result.status).json(result.body);
});

// DM update any inventory item
inventoryRouter.put("/dm/player/:playerId/:id", dmAuthMiddleware, (req, res) => {
  const params = readValidInput(res, dmItemParamsSchema, req.params, { error: "invalid_id" });
  if (!params) return;
  const body = readValidInput(res, inventoryItemBodySchema, req.body);
  if (!body) return;
  const result = processDmInventoryUpdate({
    db: getDb(),
    io: req.app.locals.io,
    playerId: params.playerId,
    itemId: params.id,
    body,
    fallbackPartyId: getSinglePartyId()
  });
  return res.status(result.status).json(result.body);
});

// DM delete any inventory item
inventoryRouter.delete("/dm/player/:playerId/:id", dmAuthMiddleware, (req, res) => {
  const params = readValidInput(res, dmItemParamsSchema, req.params, { error: "invalid_id" });
  if (!params) return;
  const result = processDmInventoryDelete({
    db: getDb(),
    io: req.app.locals.io,
    playerId: params.playerId,
    itemId: params.id,
    fallbackPartyId: getSinglePartyId()
  });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/dm/player/:playerId/bulk-visibility", dmAuthMiddleware, (req, res) => {
  const params = readValidInput(res, playerIdParamsSchema, req.params, { error: "invalid_playerId" });
  if (!params) return;
  const body = readValidInput(res, dmBulkVisibilityBodySchema, req.body);
  if (!body) return;
  const result = processDmInventoryBulkVisibility({
    db: getDb(),
    io: req.app.locals.io,
    playerId: params.playerId,
    body
  });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/dm/player/:playerId/bulk-delete", dmAuthMiddleware, (req, res) => {
  const params = readValidInput(res, playerIdParamsSchema, req.params, { error: "invalid_playerId" });
  if (!params) return;
  const body = readValidInput(res, dmBulkDeleteBodySchema, req.body);
  if (!body) return;
  const result = processDmInventoryBulkDelete({
    db: getDb(),
    io: req.app.locals.io,
    playerId: params.playerId,
    body
  });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/transfers", (req, res) => {
  const sess = requirePlayerSession(req, res, { at: now(), writable: true });
  if (!sess) return;
  const body = readValidInput(res, transferCreateBodySchema, req.body);
  if (!body) return;
  const result = processTransferCreate({ db: getDb(), io: req.app.locals.io, sess, body, nowFn: now });
  return res.status(result.status).json(result.body);
});

inventoryRouter.get("/transfers/inbox", (req, res) => {
  const sess = requirePlayerSession(req, res, { at: now() });
  if (!sess) return;
  const result = listTransferInbox({ db: getDb(), playerId: sess.player_id, nowFn: now });
  return res.status(result.status).json(result.body);
});

inventoryRouter.get("/transfers/outbox", (req, res) => {
  const sess = requirePlayerSession(req, res, { at: now() });
  if (!sess) return;
  const result = listTransferOutbox({ db: getDb(), playerId: sess.player_id, nowFn: now });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/transfers/:id/accept", (req, res) => {
  const sess = requirePlayerSession(req, res, { at: now(), writable: true });
  if (!sess) return;
  const params = readValidInput(res, transferIdParamsSchema, req.params, { error: "invalid_id" });
  if (!params) return;
  const body = readValidInput(res, emptyBodySchema, req.body);
  if (!body) return;
  const result = processTransferAccept({
    db: getDb(),
    io: req.app.locals.io,
    sess,
    transferId: params.id,
    nowFn: now
  });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/transfers/:id/reject", (req, res) => {
  const sess = requirePlayerSession(req, res, { at: now(), writable: true });
  if (!sess) return;
  const params = readValidInput(res, transferIdParamsSchema, req.params, { error: "invalid_id" });
  if (!params) return;
  const body = readValidInput(res, emptyBodySchema, req.body);
  if (!body) return;
  const result = processTransferReject({
    db: getDb(),
    io: req.app.locals.io,
    sess,
    transferId: params.id,
    nowFn: now
  });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/transfers/:id/cancel", (req, res) => {
  const sess = requirePlayerSession(req, res, { at: now(), writable: true });
  if (!sess) return;
  const params = readValidInput(res, transferIdParamsSchema, req.params, { error: "invalid_id" });
  if (!params) return;
  const body = readValidInput(res, emptyBodySchema, req.body);
  if (!body) return;
  const result = processTransferCancel({
    db: getDb(),
    io: req.app.locals.io,
    sess,
    transferId: params.id,
    nowFn: now
  });
  return res.status(result.status).json(result.body);
});

inventoryRouter.get("/transfers/dm", dmAuthMiddleware, (req, res) => {
  const query = readValidInput(res, dmTransfersQuerySchema, req.query);
  if (!query) return;
  const status = String(query.status || "pending");
  const result = listDmTransfers({ db: getDb(), status });
  return res.status(result.status).json(result.body);
});

inventoryRouter.post("/transfers/:id/dm/cancel", dmAuthMiddleware, (req, res) => {
  const params = readValidInput(res, transferIdParamsSchema, req.params, { error: "invalid_id" });
  if (!params) return;
  const body = readValidInput(res, emptyBodySchema, req.body);
  if (!body) return;
  const result = processDmTransferCancel({
    db: getDb(),
    io: req.app.locals.io,
    transferId: params.id,
    nowFn: now
  });
  return res.status(result.status).json(result.body);
});
