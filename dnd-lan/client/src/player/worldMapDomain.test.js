import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WORLD_MAP_URL,
  WORLD_MAP_SOCKET_EVENTS,
  resolveWorldMapDimensions,
  resolveWorldMapImageUrl
} from "./worldMapDomain.js";

test("resolveWorldMapImageUrl prefers current map contract and falls back safely", () => {
  assert.equal(
    resolveWorldMapImageUrl({ map: { imageUrl: "/uploads/maps/active.png" } }),
    "/uploads/maps/active.png"
  );
  assert.equal(
    resolveWorldMapImageUrl({ activeMap: { url: "/uploads/maps/legacy.png" } }),
    "/uploads/maps/legacy.png"
  );
  assert.equal(
    resolveWorldMapImageUrl({ maps: [{ filename: "only-file.png" }] }),
    "/uploads/maps/only-file.png"
  );
  assert.equal(resolveWorldMapImageUrl({}), DEFAULT_WORLD_MAP_URL);
});

test("resolveWorldMapDimensions reads width and height from state payload", () => {
  assert.deepEqual(
    resolveWorldMapDimensions({ map: { width: 2048, height: 1024 } }),
    { width: 2048, height: 1024 }
  );
  assert.equal(resolveWorldMapDimensions({ map: { width: 0, height: 1024 } }), null);
});

test("WORLD_MAP_SOCKET_EVENTS covers server-side map updates", () => {
  assert.equal(WORLD_MAP_SOCKET_EVENTS.includes("map:mapsUpdated"), true);
  assert.equal(WORLD_MAP_SOCKET_EVENTS.includes("map:locationCreated"), true);
  assert.equal(WORLD_MAP_SOCKET_EVENTS.includes("map:tokenDeleted"), true);
});
