import test from "node:test";
import assert from "node:assert/strict";
import { GAME_CATALOG, validateGameCatalog } from "../src/gameCatalog.js";

test("game catalog modes declare gameplay roles", () => {
  assert.doesNotThrow(() => validateGameCatalog(GAME_CATALOG));

  for (const game of GAME_CATALOG) {
    for (const mode of game.modes) {
      assert.match(
        String(mode.role || ""),
        /^(warmup|skill|risk|blitz|duel)$/,
        `${game.key}/${mode.key} should use a known arcade role`
      );
    }
  }
});
