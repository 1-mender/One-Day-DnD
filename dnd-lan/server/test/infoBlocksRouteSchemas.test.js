import test from "node:test";
import assert from "node:assert/strict";
import {
  infoBlockBodySchema,
  infoBlockIdParamsSchema,
  parseInfoBlocksRouteInput
} from "../src/routes/infoBlocksRouteSchemas.js";

test("info blocks route schemas parse ids and pass domain body fields", () => {
  assert.deepEqual(parseInfoBlocksRouteInput(infoBlockIdParamsSchema, { id: "7" }, "not_found"), {
    ok: true,
    data: { id: 7 }
  });
  assert.deepEqual(parseInfoBlocksRouteInput(infoBlockBodySchema, {
    title: "",
    selectedPlayerIds: { raw: true }
  }), {
    ok: true,
    data: {
      title: "",
      selectedPlayerIds: { raw: true }
    }
  });
});

test("info blocks route schemas keep route-specific id errors", () => {
  assert.deepEqual(parseInfoBlocksRouteInput(infoBlockIdParamsSchema, { id: "x" }, "not_found"), {
    ok: false,
    error: "not_found"
  });
});
