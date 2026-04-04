import test from "node:test";
import assert from "node:assert/strict";
import { dmSetupBodySchema, parseSetupRouteInput } from "../src/routes/setupRouteSchemas.js";

test("setup route schema accepts scalar setup fields", () => {
  assert.deepEqual(parseSetupRouteInput(dmSetupBodySchema, {
    username: "admin",
    password: "secret123",
    setupSecret: 123
  }), {
    ok: true,
    data: {
      username: "admin",
      password: "secret123",
      setupSecret: 123
    }
  });
});

test("setup route schema rejects object-valued setup fields", () => {
  assert.deepEqual(parseSetupRouteInput(dmSetupBodySchema, { setupSecret: { value: "x" } }), {
    ok: false,
    error: "invalid_request"
  });
});
