import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTicketGamePatch,
  applyTicketRulesPatch,
  applyTicketShopPatch,
  buildGeneralChanges,
  createDailyQuestDraft,
  isDailyQuestChanged,
  isGameChanged,
  isShopChanged
} from "./ticketRulesEditor.js";

test("buildGeneralChanges detects changed fields", () => {
  const base = { enabled: true, dailyEarnCap: 10, streak: { max: 2, step: 0.1, flatBonus: 1 } };
  const cur = { enabled: false, dailyEarnCap: 10, streak: { max: 3, step: 0.1, flatBonus: 1 } };
  const diff = buildGeneralChanges(cur, base);
  assert.equal(diff.enabled, true);
  assert.equal(diff.streakMax, true);
  assert.equal(diff.dailyEarnCap, false);
});

test("rule patch helpers keep nested shape", () => {
  const base = { streak: { max: 1 }, dailyQuest: { pool: [] }, games: {}, shop: {} };
  const next = applyTicketRulesPatch(base, { streak: { max: 3 }, dailyQuest: { activeKey: "q1" } });
  assert.equal(next.streak.max, 3);
  assert.equal(next.dailyQuest.activeKey, "q1");

  const gamePatched = applyTicketGamePatch(next, "ttt", { ui: { difficulty: "hard" }, entryCost: 2 });
  assert.equal(gamePatched.games.ttt.ui.difficulty, "hard");
  assert.equal(gamePatched.games.ttt.entryCost, 2);

  const shopPatched = applyTicketShopPatch(gamePatched, "stat", { price: 7, dailyLimit: 1 });
  assert.equal(shopPatched.shop.stat.price, 7);
  assert.equal(shopPatched.shop.stat.dailyLimit, 1);
});

test("change detectors compare base and current values", () => {
  const base = {
    games: { ttt: { enabled: true, entryCost: 1, rewardMin: 1, rewardMax: 2, lossPenalty: 0, dailyLimit: 5, ui: { difficulty: "easy", risk: "low", time: "2m" } } },
    shop: { stat: { enabled: true, price: 1, dailyLimit: 1 } },
    dailyQuest: { enabled: true, activeKey: "q1", pool: [{ key: "q1" }] }
  };
  const gameChanged = isGameChanged(base, "ttt", { ...base.games.ttt, entryCost: 2 });
  const shopChanged = isShopChanged(base, "stat", { ...base.shop.stat, price: 2 });
  const questChanged = isDailyQuestChanged({ dailyQuest: { enabled: false } }, base);
  assert.equal(gameChanged, true);
  assert.equal(shopChanged, true);
  assert.equal(questChanged, true);
});

test("createDailyQuestDraft returns valid quest object", () => {
  const quest = createDailyQuestDraft();
  assert.equal(typeof quest.key, "string");
  assert.equal(quest.enabled, true);
  assert.equal(quest.goal, 2);
  assert.equal(quest.reward, 2);
});
