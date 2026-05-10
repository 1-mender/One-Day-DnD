import { now } from "../../util.js";

export function getQuestProgress(db, playerId, dayKey) {
  const row = db
    .prepare("SELECT COUNT(DISTINCT game_key) AS c FROM ticket_plays WHERE player_id=? AND day_key=?")
    .get(playerId, dayKey);
  return Number(row?.c || 0);
}

export function getActiveQuest(rules) {
  const dq = rules?.dailyQuest;
  if (!dq || dq.enabled === false) return null;
  const pool = Array.isArray(dq.pool) ? dq.pool : [];
  let q = pool.find((x) => x.key === dq.activeKey && x.enabled !== false);
  if (!q) q = pool.find((x) => x.enabled !== false) || null;
  return q;
}

export function getQuestStates(db, playerId, dayKey, rules) {
  const q = getActiveQuest(rules);
  if (!q) return [];
  const distinctGames = getQuestProgress(db, playerId, dayKey);
  const row = db.prepare(
    "SELECT reward_granted, rewarded_at FROM ticket_quests WHERE player_id=? AND quest_key=? AND day_key=?"
  ).get(playerId, q.key, dayKey);
  const completed = distinctGames >= q.goal;
  return [{
    key: q.key,
    title: q.title,
    description: q.description,
    goal: q.goal,
    progress: distinctGames,
    reward: q.reward,
    completed,
    rewarded: !!row,
    rewardGranted: row?.reward_granted ?? 0,
    rewardedAt: row?.rewarded_at ?? null
  }];
}

export function getQuestHistory(db, playerId, dayKey, rules, days = 7) {
  const q = getActiveQuest(rules);
  if (!q) return [];
  const d = Math.max(1, Math.min(30, Math.floor(Number(days) || 7)));
  const minDay = dayKey - (d - 1);
  const rows = db.prepare(
    "SELECT day_key, reward_granted, rewarded_at FROM ticket_quests WHERE player_id=? AND quest_key=? AND day_key>=? ORDER BY day_key DESC"
  ).all(playerId, q.key, minDay);
  return rows.map((r) => ({
    dayKey: r.day_key,
    rewardGranted: r.reward_granted ?? 0,
    rewardedAt: r.rewarded_at ?? null
  }));
}

export function maybeGrantDailyQuest(db, playerId, dayKey, rules) {
  const q = getActiveQuest(rules);
  if (!q) return null;
  const distinctGames = getQuestProgress(db, playerId, dayKey);
  if (distinctGames < q.goal) return null;

  const existing = db.prepare(
    "SELECT 1 FROM ticket_quests WHERE player_id=? AND quest_key=? AND day_key=?"
  ).get(playerId, q.key, dayKey);
  if (existing) return null;

  const row = db.prepare("SELECT balance, daily_earned FROM tickets WHERE player_id=?").get(playerId);
  const currentEarned = Number(row?.daily_earned || 0);
  const currentBalance = Number(row?.balance || 0);

  let reward = Number(q.reward || 0);
  const cap = Number(rules?.dailyEarnCap || 0);
  if (cap > 0) {
    reward = Math.max(0, Math.min(reward, cap - currentEarned));
  }

  const t = now();
  const tx = db.transaction(() => {
    db.prepare(
      "INSERT INTO ticket_quests(player_id, quest_key, day_key, reward_granted, rewarded_at, created_at) VALUES(?,?,?,?,?,?)"
    ).run(playerId, q.key, dayKey, reward, t, t);
    if (reward > 0) {
      db.prepare("UPDATE tickets SET balance=?, daily_earned=?, updated_at=? WHERE player_id=?")
        .run(currentBalance + reward, currentEarned + reward, t, playerId);
    }
  });
  tx();

  return { questKey: q.key, rewardGranted: reward };
}
