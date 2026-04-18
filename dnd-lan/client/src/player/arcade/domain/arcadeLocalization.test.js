import test from "node:test";
import assert from "node:assert/strict";
import { localizeGameCard, localizeModeRole } from "./arcadeLocalization.js";

test("localizeModeRole returns Russian label and description", () => {
  const role = localizeModeRole("risk");
  assert.equal(role.key, "risk");
  assert.equal(role.label, "Риск");
  assert.match(role.description, /высок/i);
});

test("localizeGameCard enriches mode roles for UI cards", () => {
  const game = localizeGameCard({
    key: "dice",
    title: "Dice",
    blurb: "Roll",
    rules: [],
    modes: [{ key: "risk", label: "Risk", role: "risk" }]
  });

  assert.equal(game.modes[0].label, "Риск");
  assert.equal(game.modes[0].role, "risk");
  assert.equal(game.modes[0].roleLabel, "Риск");
  assert.ok(game.modes[0].roleDescription);
});
