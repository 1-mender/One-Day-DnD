import test from "node:test";
import assert from "node:assert/strict";
import {
  changePasswordBodySchema,
  dmLoginBodySchema,
  parseAuthRouteInput,
  playerSessionBodySchema
} from "../src/routes/authRouteSchemas.js";

test("auth route schemas accept scalar credentials and tokens", () => {
  assert.deepEqual(parseAuthRouteInput(dmLoginBodySchema, {
    username: "dm",
    password: 123456
  }), {
    ok: true,
    data: {
      username: "dm",
      password: 123456
    }
  });
  assert.deepEqual(parseAuthRouteInput(changePasswordBodySchema, { newPassword: "secret123" }), {
    ok: true,
    data: { newPassword: "secret123" }
  });
  assert.deepEqual(parseAuthRouteInput(playerSessionBodySchema, { playerToken: "token" }), {
    ok: true,
    data: { playerToken: "token" }
  });
});

test("auth route schemas reject object values in scalar fields", () => {
  assert.deepEqual(parseAuthRouteInput(dmLoginBodySchema, { username: { raw: "dm" } }), {
    ok: false,
    error: "invalid_request"
  });
  assert.deepEqual(parseAuthRouteInput(playerSessionBodySchema, { playerToken: { raw: "token" } }), {
    ok: false,
    error: "invalid_request"
  });
});
