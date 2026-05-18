import test from "node:test";
import assert from "node:assert/strict";
import {
  applyDmProfileTemplate,
  detectDmProfileTemplate,
  EMPTY_DM_PROFILE_FORM,
  formatProfileRequestValue,
  hasAnyData,
  hasUnsavedChanges,
  mergeDmProfileStats,
  normalizeDmProfileStats,
  normalizeRequestChanges
} from "./playerProfileAdminDomain.js";

test("normalizeRequestChanges coerces primitive fields and parses stats JSON", () => {
  const changes = normalizeRequestChanges({
    characterName: "Lia",
    level: "4",
    stats: "{\"str\":12}",
    bio: null
  });

  assert.deepEqual(changes, {
    characterName: "Lia",
    level: 4,
    stats: { str: 12 },
    bio: ""
  });
});

test("hasAnyData detects meaningful content and rights", () => {
  assert.equal(hasAnyData(EMPTY_DM_PROFILE_FORM), false);
  assert.equal(hasAnyData({ ...EMPTY_DM_PROFILE_FORM, characterName: "Lia" }), true);
  assert.equal(hasAnyData({ ...EMPTY_DM_PROFILE_FORM, editableFields: ["bio"] }), true);
});

test("hasUnsavedChanges compares normalized snapshots", () => {
  const profile = {
    characterName: "Lia",
    classRole: "Mage",
    level: 3,
    stats: { dex: 12, str: 10 },
    bio: "Text",
    avatarUrl: "",
    editableFields: ["bio", "stats"],
    allowRequests: true
  };

  assert.equal(hasUnsavedChanges({ ...profile, editableFields: ["stats", "bio"] }, profile), false);
  assert.equal(hasUnsavedChanges({ ...profile, bio: "Changed" }, profile), true);
});

test("normalizeDmProfileStats preserves existing race variant when patch omits it", () => {
  const stats = normalizeDmProfileStats(
    { str: 12 },
    { race: "elf", raceVariant: "high", dex: 14 }
  );

  assert.deepEqual(stats, {
    str: 12,
    race: "elf",
    raceVariant: "high"
  });
});

test("mergeDmProfileStats keeps origin on presets and resets invalid variant on race change", () => {
  assert.deepEqual(
    mergeDmProfileStats(
      { str: 15, dex: 13 },
      { race: "elf", raceVariant: "dusk", wis: 9 }
    ),
    {
      race: "elf",
      raceVariant: "dusk",
      wis: 9,
      str: 15,
      dex: 13
    }
  );

  assert.deepEqual(
    mergeDmProfileStats(
      { race: "human", str: 11 },
      { race: "elf", raceVariant: "high", dex: 14 }
    ),
    {
      race: "human",
      raceVariant: "city",
      dex: 14,
      str: 11
    }
  );
});

test("hasUnsavedChanges detects raceVariant-only change", () => {
  const profile = {
    ...EMPTY_DM_PROFILE_FORM,
    stats: { race: "elf", raceVariant: "high" }
  };

  assert.equal(hasUnsavedChanges({ ...profile, stats: { race: "elf", raceVariant: "wood" } }, profile), true);
});

test("formatProfileRequestValue serializes objects for readable previews", () => {
  assert.equal(formatProfileRequestValue("abc"), "abc");
  assert.match(formatProfileRequestValue({ str: 12 }), /"str": 12/);
});

test("applyDmProfileTemplate switches to modern layout and clears fantasy path", () => {
  const next = applyDmProfileTemplate({
    ...EMPTY_DM_PROFILE_FORM,
    classKey: "warrior",
    specializationKey: "guardian",
    publicFields: ["classPath", "race", "level"],
    stats: {
      race: "elf",
      raceVariant: "high",
      str: 15,
      dex: 13,
      faction: "Wardens"
    }
  }, "modern");

  assert.equal(next.classKey, "");
  assert.equal(next.specializationKey, "");
  assert.deepEqual(next.publicFields, ["level"]);
  assert.deepEqual(next.stats, {
    faction: "Wardens",
    body: 10,
    agility: 10,
    mind: 10,
    tech: 10,
    empathy: 10,
    grit: 10
  });
});

test("applyDmProfileTemplate keeps origin and extra fields on fantasy layout", () => {
  const next = applyDmProfileTemplate({
    ...EMPTY_DM_PROFILE_FORM,
    stats: {
      body: 8,
      mind: 12,
      race: "elf",
      raceVariant: "wood",
      world: "Aster"
    }
  }, "fantasy");

  assert.equal(next.stats.race, "elf");
  assert.equal(next.stats.raceVariant, "wood");
  assert.equal(next.stats.world, "Aster");
  assert.equal(next.stats.str, 10);
  assert.equal(next.stats.dex, 10);
  assert.equal(next.stats.body, undefined);
});

test("detectDmProfileTemplate distinguishes fantasy and sci-fi layouts", () => {
  assert.equal(detectDmProfileTemplate({ classKey: "warrior", stats: { str: 10 } }), "fantasy");
  assert.equal(detectDmProfileTemplate({ stats: { systems: 12, reflex: 11 } }), "scifi");
  assert.equal(detectDmProfileTemplate({ stats: {} }), "custom");
});
