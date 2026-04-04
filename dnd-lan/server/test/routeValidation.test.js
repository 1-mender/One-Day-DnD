import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { createRouteInputReader, parseRouteInput } from "../src/routes/routeValidation.js";

function createResponseProbe() {
  return {
    body: null,
    statusCode: 200,
    json(payload) {
      this.body = payload;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    }
  };
}

test("parseRouteInput parses valid objects and defaults to invalid_request on failure", () => {
  const schema = z.object({ id: z.coerce.number().int().positive() });

  assert.deepEqual(parseRouteInput(schema, { id: "42" }), {
    ok: true,
    data: { id: 42 }
  });

  assert.deepEqual(parseRouteInput(schema, { id: "nope" }), {
    ok: false,
    error: "invalid_request"
  });
});

test("parseRouteInput preserves custom route-specific error codes", () => {
  const schema = z.object({ id: z.coerce.number().int().positive() });

  assert.deepEqual(parseRouteInput(schema, { id: "nope" }, "not_found"), {
    ok: false,
    error: "not_found"
  });
});

test("createRouteInputReader returns parsed data and writes configured error payloads", () => {
  const schema = z.object({ id: z.coerce.number().int().positive() });
  const parseInput = (candidateSchema, input, error) => parseRouteInput(candidateSchema, input, error);
  const readValidInput = createRouteInputReader(parseInput, { status: 422, error: "invalid_custom" });

  const successRes = createResponseProbe();
  assert.deepEqual(readValidInput(successRes, schema, { id: "7" }), { id: 7 });
  assert.equal(successRes.statusCode, 200);
  assert.equal(successRes.body, null);

  const defaultErrorRes = createResponseProbe();
  assert.equal(readValidInput(defaultErrorRes, schema, { id: "bad" }), null);
  assert.equal(defaultErrorRes.statusCode, 422);
  assert.deepEqual(defaultErrorRes.body, { error: "invalid_custom" });

  const overrideErrorRes = createResponseProbe();
  assert.equal(
    readValidInput(overrideErrorRes, schema, { id: "bad" }, { status: 404, error: "not_found" }),
    null
  );
  assert.equal(overrideErrorRes.statusCode, 404);
  assert.deepEqual(overrideErrorRes.body, { error: "not_found" });
});
