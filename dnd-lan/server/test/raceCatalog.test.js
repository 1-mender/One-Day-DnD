import test from "node:test";
import assert from "node:assert/strict";
import {
  getRaceDisplayLabel,
  getRaceProfile,
  setRaceInStats,
  setRaceVariantInStats
} from "../../shared/raceCatalog.js";
import { getInventoryLimitFromStats } from "../src/inventoryLimit.js";

test("race catalog resolves base race and variant", () => {
  const profile = getRaceProfile({ race: "elf", raceVariant: "high" });

  assert.equal(profile.raceKey, "elf");
  assert.equal(profile.variantKey, "high");
  assert.equal(profile.displayName, "Высший эльф");
  assert.equal(getRaceDisplayLabel({ race: "эльф", raceVariant: "wood" }), "Лесной эльф");
});

test("race stats helpers keep a valid variant per selected race", () => {
  const elfStats = setRaceInStats({ raceVariant: "noble" }, "elf");
  assert.deepEqual(elfStats, { raceVariant: "city", race: "elf" });

  const highElfStats = setRaceVariantInStats(elfStats, "high");
  assert.deepEqual(highElfStats, { raceVariant: "high", race: "elf" });
});

test("inventory limit uses race catalog carry bonus", () => {
  assert.deepEqual(getInventoryLimitFromStats({ race: "goliath", raceVariant: "arena" }, 20), {
    base: 20,
    race: "goliath",
    raceVariant: "arena",
    bonus: 10,
    limit: 30
  });
});
