const DEFAULT_DAILY_QUEST = {
  enabled: true,
  key: "daily_mix",
  title: "Игровой микс",
  description: "Сыграй сегодня в 2 разные игры",
  goal: 2,
  reward: 2
};

export const DEFAULT_TICKET_RULES = {
  enabled: true,
  dailyEarnCap: 14,
  dailySpendCap: 0,
  dailyShopCap: 0,
  streak: {
    max: 3,
    step: 0.05,
    flatBonus: 1
  },
  games: {
    ttt: {
      enabled: true,
      entryCost: 0,
      rewardMin: 1,
      rewardMax: 3,
      lossPenalty: 0,
      dailyLimit: 10,
      ui: {
        difficulty: "ЛЕГКО",
        risk: "Низкий",
        time: "2-4 min"
      },
      performance: {
        normal: { label: "Победа", multiplier: 1 },
        sweep: { label: "Победа 2-0", multiplier: 1.15 }
      }
    },
    guess: {
      enabled: true,
      entryCost: 1,
      rewardMin: 2,
      rewardMax: 4,
      lossPenalty: 1,
      dailyLimit: 8,
      ui: {
        difficulty: "СРЕДНЕ",
        risk: "Средний",
        time: "3-5 min"
      },
      performance: {
        first: { label: "С первой попытки", multiplier: 1.2 },
        second: { label: "Со второй попытки", multiplier: 1.05 },
        third: { label: "С третьей попытки", multiplier: 1 }
      }
    },
    match3: {
      enabled: true,
      entryCost: 1,
      rewardMin: 2,
      rewardMax: 5,
      lossPenalty: 1,
      dailyLimit: 6,
      ui: {
        difficulty: "СРЕДНЕ",
        risk: "Средний",
        time: "4-6 min"
      },
      performance: {
        normal: { label: "Комбо 3", multiplier: 1 },
        combo4: { label: "Комбо 4+", multiplier: 1.1 },
        combo5: { label: "Комбо 5+", multiplier: 1.2 }
      }
    },
    dice: {
      enabled: true,
      entryCost: 1,
      rewardMin: 2,
      rewardMax: 5,
      lossPenalty: 1,
      dailyLimit: 5,
      ui: {
        difficulty: "СРЕДНЕ",
        risk: "Средний",
        time: "2-4 min"
      },
      performance: {
        normal: { label: "Удачный бросок", multiplier: 1 },
        smart: { label: "Сильная комбинация", multiplier: 1.15 },
        elite: { label: "Элитная комбинация", multiplier: 1.3 }
      }
    },
    scrabble: {
      enabled: true,
      entryCost: 1,
      rewardMin: 3,
      rewardMax: 6,
      lossPenalty: 2,
      dailyLimit: 5,
      ui: {
        difficulty: "СЛОЖНО",
        risk: "Высокий",
        time: "2-3 min"
      },
      performance: {
        normal: { label: "Слово собрано", multiplier: 1 },
        long: { label: "6+ букв", multiplier: 1.2 },
        rare: { label: "Редкая буква", multiplier: 1.1 }
      }
    }
  },
  shop: {
    stat: { enabled: true, price: 12, dailyLimit: 1 },
    feat: { enabled: true, price: 15, dailyLimit: 1 },
    reroll: { enabled: true, price: 4, dailyLimit: 2 },
    luck: { enabled: true, price: 3, dailyLimit: 3 },
    chest: { enabled: true, price: 7, dailyLimit: 1 },
    hint: { enabled: true, price: 5, dailyLimit: 2 }
  },
  autoBalance: {
    enabled: false,
    windowDays: 7,
    targetWinRate: 0.55,
    rewardStep: 1,
    penaltyStep: 1,
    minPlays: 20
  },
  dailyQuest: {
    enabled: true,
    activeKey: DEFAULT_DAILY_QUEST.key,
    pool: [DEFAULT_DAILY_QUEST]
  }
};

function isMojibakeText(value) {
  const s = String(value || "");
  if (!s) return false;
  // Typical broken UTF-8/cp1251 artifacts found in legacy strings.
  return /(?:Р.|С.){2,}|вЂ|в†|в€|в„–|Ѓ|Ђ|Ћ|њ|џ/.test(s);
}

export function sanitizeRulesText(rules, defaults) {
  const next = { ...(rules || {}) };
  const def = defaults || DEFAULT_TICKET_RULES;
  const games = { ...(next.games || {}) };
  for (const [gameKey, gameRule] of Object.entries(games)) {
    const fallbackGame = def?.games?.[gameKey] || {};
    const ui = { ...(gameRule?.ui || {}) };
    const fallbackUi = fallbackGame?.ui || {};
    if (isMojibakeText(ui.difficulty) && fallbackUi.difficulty) ui.difficulty = fallbackUi.difficulty;
    if (isMojibakeText(ui.risk) && fallbackUi.risk) ui.risk = fallbackUi.risk;
    if (isMojibakeText(ui.time) && fallbackUi.time) ui.time = fallbackUi.time;

    const performance = { ...(gameRule?.performance || {}) };
    const fallbackPerf = fallbackGame?.performance || {};
    for (const [perfKey, perfRule] of Object.entries(performance)) {
      if (!isMojibakeText(perfRule?.label)) continue;
      const fallbackLabel = fallbackPerf?.[perfKey]?.label;
      if (fallbackLabel) {
        performance[perfKey] = { ...perfRule, label: fallbackLabel };
      }
    }

    games[gameKey] = { ...(gameRule || {}), ui, performance };
  }
  next.games = games;

  const dq = { ...(next.dailyQuest || {}) };
  const fallbackDq = def?.dailyQuest || {};
  if (isMojibakeText(dq.activeKey) && fallbackDq.activeKey) dq.activeKey = fallbackDq.activeKey;
  const pool = Array.isArray(dq.pool) ? dq.pool.map((item, idx) => {
    const fallbackItem = Array.isArray(fallbackDq.pool) ? fallbackDq.pool[idx] || {} : {};
    const fixed = { ...(item || {}) };
    if (isMojibakeText(fixed.title) && fallbackItem.title) fixed.title = fallbackItem.title;
    if (isMojibakeText(fixed.description) && fallbackItem.description) fixed.description = fallbackItem.description;
    return fixed;
  }) : [];
  if (pool.length) dq.pool = pool;
  next.dailyQuest = dq;

  return next;
}
