import test from "node:test";
import assert from "node:assert/strict";
import {
  getPlayerPrimaryName,
  getPlayerSecondaryName,
  getPublicProfileMeta,
  matchesPlayerQuery,
  matchesStatusFilter
} from "./publicProfileViewModel.js";

test("public profile helpers prefer character name and preserve player handle", () => {
  const player = {
    displayName: "Nik",
    publicProfile: {
      characterName: "Aria",
      classRole: "Ranger",
      level: 4,
      race: "elf"
    }
  };

  assert.equal(getPlayerPrimaryName(player), "Aria");
  assert.equal(getPlayerSecondaryName(player), "Nik");
  assert.equal(getPublicProfileMeta(player.publicProfile), "Ranger • lvl 4 • race: Городской эльф");
});

test("public profile meta includes specialization role when class path is public", () => {
  assert.equal(
    getPublicProfileMeta({
      classKey: "warrior",
      specializationKey: "berserker",
      level: 5
    }),
    "Воин · Берсерк · Урон • lvl 5"
  );
});

test("matchesPlayerQuery checks both player and character names", () => {
  const player = {
    displayName: "Nik",
    publicProfile: { characterName: "Aria" }
  };

  assert.equal(matchesPlayerQuery(player, "nik"), true);
  assert.equal(matchesPlayerQuery(player, "aria"), true);
  assert.equal(matchesPlayerQuery(player, "mage"), false);
});

test("matchesStatusFilter groups idle with online and isolates offline", () => {
  assert.equal(matchesStatusFilter({ status: "online" }, "online"), true);
  assert.equal(matchesStatusFilter({ status: "idle" }, "online"), true);
  assert.equal(matchesStatusFilter({ status: "offline" }, "online"), false);
  assert.equal(matchesStatusFilter({ status: "offline" }, "offline"), true);
  assert.equal(matchesStatusFilter({ status: "idle" }, "offline"), false);
  assert.equal(matchesStatusFilter({ status: "idle" }, "all"), true);
});
