import test from "node:test";
import assert from "node:assert/strict";
import {
  dmAdjustBodySchema,
  dmAdjustBulkBodySchema,
  parseTicketRouteInput
} from "../src/tickets/routes/dmTicketRouteSchemas.js";

test("dm ticket schemas accept valid single and bulk adjust payloads", () => {
  assert.deepEqual(parseTicketRouteInput(dmAdjustBodySchema, {
    playerId: "42",
    delta: "3",
    reason: " scene reward "
  }), {
    ok: true,
    data: {
      playerId: 42,
      delta: 3,
      reason: "scene reward"
    }
  });

  assert.deepEqual(parseTicketRouteInput(dmAdjustBulkBodySchema, {
    playerIds: ["4", 7, "9"],
    delta: "-2",
    reason: " correction "
  }), {
    ok: true,
    data: {
      playerIds: [4, 7, 9],
      delta: -2,
      reason: "correction"
    }
  });
});

test("dm ticket bulk schema rejects empty or noop payloads", () => {
  assert.deepEqual(parseTicketRouteInput(dmAdjustBulkBodySchema, {
    playerIds: [],
    delta: 1
  }), {
    ok: false,
    error: "invalid_request"
  });

  assert.deepEqual(parseTicketRouteInput(dmAdjustBulkBodySchema, {
    playerIds: [1, 2],
    delta: 0
  }), {
    ok: false,
    error: "invalid_request"
  });
});
