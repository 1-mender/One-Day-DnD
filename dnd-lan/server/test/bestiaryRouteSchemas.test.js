import test from "node:test";
import assert from "node:assert/strict";
import {
  bestiaryImagesQuerySchema,
  bestiaryListQuerySchema,
  bestiarySettingsToggleBodySchema,
  monsterBodySchema,
  monsterIdParamsSchema,
  parseBestiaryRouteInput
} from "../src/routes/bestiaryRouteSchemas.js";

test("bestiary route schemas coerce query and id params", () => {
  assert.deepEqual(parseBestiaryRouteInput(bestiaryListQuerySchema, {
    q: "orc",
    limit: "25",
    includeImages: "1",
    imagesLimit: "3"
  }), {
    ok: true,
    data: {
      q: "orc",
      limit: 25,
      includeImages: "1",
      imagesLimit: 3
    }
  });
  assert.deepEqual(parseBestiaryRouteInput(bestiaryImagesQuerySchema, { ids: "1,2,3", limitPer: "2" }), {
    ok: true,
    data: { ids: "1,2,3", limitPer: 2 }
  });
  assert.deepEqual(parseBestiaryRouteInput(monsterIdParamsSchema, { id: "9" }, "not_found"), {
    ok: true,
    data: { id: 9 }
  });
});

test("bestiary route schemas pass domain body fields and preserve not_found ids", () => {
  assert.deepEqual(parseBestiaryRouteInput(monsterBodySchema, {
    name: "",
    stats: "not-json",
    is_hidden: 1
  }), {
    ok: true,
    data: {
      name: "",
      stats: "not-json",
      is_hidden: 1
    }
  });
  assert.deepEqual(parseBestiaryRouteInput(bestiarySettingsToggleBodySchema, { enabled: "yes" }), {
    ok: true,
    data: { enabled: "yes" }
  });
  assert.deepEqual(parseBestiaryRouteInput(monsterIdParamsSchema, { id: "x" }, "not_found"), {
    ok: false,
    error: "not_found"
  });
});
