import test from "node:test";
import assert from "node:assert/strict";
import {
  dmItemParamsSchema,
  dmTransfersQuerySchema,
  inventoryItemBodySchema,
  itemIdParamsSchema,
  parseInventoryRouteInput,
  playerIdParamsSchema,
  transferCreateBodySchema,
  transferIdParamsSchema
} from "../src/routes/inventoryRouteSchemas.js";

test("inventory route schemas coerce ids and trim query status", () => {
  assert.deepEqual(parseInventoryRouteInput(playerIdParamsSchema, { playerId: "42" }, "invalid_playerId"), {
    ok: true,
    data: { playerId: 42 }
  });
  assert.deepEqual(parseInventoryRouteInput(itemIdParamsSchema, { id: "7" }, "invalid_id"), {
    ok: true,
    data: { id: 7 }
  });
  assert.deepEqual(parseInventoryRouteInput(dmItemParamsSchema, { playerId: "9", id: "11" }, "invalid_id"), {
    ok: true,
    data: { playerId: 9, id: 11 }
  });
  assert.deepEqual(parseInventoryRouteInput(transferIdParamsSchema, { id: "13" }, "invalid_id"), {
    ok: true,
    data: { id: 13 }
  });
  assert.deepEqual(parseInventoryRouteInput(dmTransfersQuerySchema, { status: " pending " }), {
    ok: true,
    data: { status: "pending" }
  });
});

test("inventory route schemas preserve domain validation payloads", () => {
  assert.deepEqual(parseInventoryRouteInput(inventoryItemBodySchema, {
    name: "",
    qty: "nope",
    tags: { raw: true }
  }), {
    ok: true,
    data: {
      name: "",
      qty: "nope",
      tags: { raw: true }
    }
  });
  assert.deepEqual(parseInventoryRouteInput(transferCreateBodySchema, {
    to_player_id: "2",
    item_id: "3",
    qty: "4",
    note: { text: "gift" }
  }), {
    ok: true,
    data: {
      to_player_id: "2",
      item_id: "3",
      qty: "4",
      note: { text: "gift" }
    }
  });
});

test("inventory route schemas keep route-specific id errors", () => {
  assert.deepEqual(parseInventoryRouteInput(playerIdParamsSchema, { playerId: "x" }, "invalid_playerId"), {
    ok: false,
    error: "invalid_playerId"
  });
  assert.deepEqual(parseInventoryRouteInput(itemIdParamsSchema, { id: "x" }, "invalid_id"), {
    ok: false,
    error: "invalid_id"
  });
});
