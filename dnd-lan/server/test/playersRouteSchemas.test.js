import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePlayersRouteInput,
  playerIdParamsSchema,
  playerRenameBodySchema
} from "../src/routes/playersRouteSchemas.js";

test("players route schemas coerce ids and accept scalar display names", () => {
  assert.deepEqual(parsePlayersRouteInput(playerIdParamsSchema, { id: "42" }, "invalid_playerId"), {
    ok: true,
    data: { id: 42 }
  });
  assert.deepEqual(parsePlayersRouteInput(playerRenameBodySchema, { displayName: "Hero" }), {
    ok: true,
    data: { displayName: "Hero" }
  });
});

test("players route schemas reject object payloads in scalar fields", () => {
  assert.deepEqual(parsePlayersRouteInput(playerRenameBodySchema, { displayName: { value: "Hero" } }), {
    ok: false,
    error: "invalid_request"
  });
  assert.deepEqual(parsePlayersRouteInput(playerIdParamsSchema, { id: { nested: 1 } }, "invalid_playerId"), {
    ok: false,
    error: "invalid_playerId"
  });
});
