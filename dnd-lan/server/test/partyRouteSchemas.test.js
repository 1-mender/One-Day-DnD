import test from "node:test";
import assert from "node:assert/strict";
import {
  impersonateBodySchema,
  joinCodeBodySchema,
  joinRequestBodySchema,
  joinRequestDecisionBodySchema,
  parsePartyRouteInput,
  playerActionBodySchema
} from "../src/routes/partyRouteSchemas.js";

test("party route schemas accept expected primitive payloads", () => {
  assert.deepEqual(parsePartyRouteInput(joinRequestBodySchema, {
    displayName: "Hero",
    joinCode: 123
  }), {
    ok: true,
    data: {
      displayName: "Hero",
      joinCode: 123
    }
  });

  assert.deepEqual(parsePartyRouteInput(joinRequestDecisionBodySchema, { joinRequestId: "abc" }), {
    ok: true,
    data: { joinRequestId: "abc" }
  });

  assert.deepEqual(parsePartyRouteInput(playerActionBodySchema, { playerId: "42" }), {
    ok: true,
    data: { playerId: "42" }
  });

  assert.deepEqual(parsePartyRouteInput(joinCodeBodySchema, { joinCode: "" }), {
    ok: true,
    data: { joinCode: "" }
  });

  assert.deepEqual(parsePartyRouteInput(impersonateBodySchema, { playerId: 7, mode: "rw" }), {
    ok: true,
    data: { playerId: 7, mode: "rw" }
  });
});

test("party route schemas reject object payloads in scalar fields", () => {
  assert.deepEqual(parsePartyRouteInput(joinRequestBodySchema, { displayName: { value: "x" } }), {
    ok: false,
    error: "invalid_request"
  });
  assert.deepEqual(parsePartyRouteInput(playerActionBodySchema, { playerId: { id: 1 } }), {
    ok: false,
    error: "invalid_request"
  });
});
