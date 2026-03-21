import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_DM_PROFILE_FORM,
  formatProfileRequestValue,
  hasAnyData,
  hasUnsavedChanges,
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

test("formatProfileRequestValue serializes objects for readable previews", () => {
  assert.equal(formatProfileRequestValue("abc"), "abc");
  assert.match(formatProfileRequestValue({ str: 12 }), /"str": 12/);
});
