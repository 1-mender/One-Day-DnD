import test from "node:test";
import assert from "node:assert/strict";
import {
  dmProfilePresetsBodySchema,
  parseProfileRouteInput,
  playerIdParamsSchema,
  playerProfileRequestCreateBodySchema,
  profileRequestIdParamsSchema,
  profileRequestResolutionBodySchema,
  profileRequestsQuerySchema,
  profileUpsertBodySchema
} from "../src/routes/profileRouteSchemas.js";

test("profile route schemas coerce params and query values", () => {
  assert.deepEqual(parseProfileRouteInput(playerIdParamsSchema, { id: "42" }, "invalid_playerId"), {
    ok: true,
    data: { id: 42 }
  });
  assert.deepEqual(parseProfileRouteInput(profileRequestIdParamsSchema, { id: "17" }, "invalid_request_id"), {
    ok: true,
    data: { id: 17 }
  });
  assert.deepEqual(parseProfileRouteInput(profileRequestsQuerySchema, { status: " pending ", limit: "25" }), {
    ok: true,
    data: { status: "pending", limit: 25 }
  });
});

test("profile route schemas accept business-validation payloads without replacing domain errors", () => {
  assert.deepEqual(parseProfileRouteInput(profileUpsertBodySchema, {
    stats: "nope",
    bio: 123,
    publicFields: ["classRole", "level"],
    publicBlurb: 123
  }), {
    ok: true,
    data: { stats: "nope", bio: 123, publicFields: ["classRole", "level"], publicBlurb: 123 }
  });
  assert.deepEqual(parseProfileRouteInput(playerProfileRequestCreateBodySchema, {
    proposedChanges: { bio: "Update" },
    reason: { text: "later" }
  }), {
    ok: true,
    data: {
      proposedChanges: { bio: "Update" },
      reason: { text: "later" }
    }
  });
  assert.deepEqual(parseProfileRouteInput(profileRequestResolutionBodySchema, { note: 123 }), {
    ok: true,
    data: { note: 123 }
  });
  assert.deepEqual(parseProfileRouteInput(dmProfilePresetsBodySchema, {
    reset: true,
    access: { enabled: false },
    presets: [{ title: "One" }]
  }), {
    ok: true,
    data: {
      reset: true,
      access: { enabled: false },
      presets: [{ title: "One" }]
    }
  });
});

test("profile route schemas preserve route-specific error codes for bad ids", () => {
  assert.deepEqual(parseProfileRouteInput(playerIdParamsSchema, { id: "x" }, "invalid_playerId"), {
    ok: false,
    error: "invalid_playerId"
  });
  assert.deepEqual(parseProfileRouteInput(profileRequestIdParamsSchema, { id: "x" }, "invalid_request_id"), {
    ok: false,
    error: "invalid_request_id"
  });
});
