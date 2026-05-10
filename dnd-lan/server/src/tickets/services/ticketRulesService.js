import { getDb, getPartySettings, setPartySettings } from "../../db.js";
import { jsonParse } from "../../util.js";
import { DEFAULT_TICKET_RULES, sanitizeRulesText } from "../domain/defaultRules.js";
import { mergeRules, normalizeRules } from "../domain/rules.js";
import { getDayKey } from "../shared/ticketUtils.js";

function applyAutoBalance(db, partyId, rules) {
  if (!rules.autoBalance?.enabled) return rules;
  const dayKey = getDayKey();
  const windowDays = Number(rules.autoBalance.windowDays || 7);
  const minDay = dayKey - windowDays + 1;
  const stats = db.prepare(
    `SELECT tp.game_key as gameKey,
            SUM(CASE WHEN tp.outcome='win' THEN 1 ELSE 0 END) as wins,
            COUNT(*) as total
       FROM ticket_plays tp
       JOIN players p ON p.id = tp.player_id
      WHERE p.party_id = ? AND tp.day_key >= ?
      GROUP BY tp.game_key`
  ).all(partyId, minDay);
  const statsMap = new Map(stats.map((row) => [row.gameKey, row]));
  const nextRules = { ...rules, games: { ...rules.games } };
  for (const [key, game] of Object.entries(rules.games || {})) {
    const row = statsMap.get(key);
    if (!row || Number(row.total || 0) < rules.autoBalance.minPlays) {
      nextRules.games[key] = { ...game };
      continue;
    }
    const winRate = Number(row.wins || 0) / Number(row.total || 1);
    const tweak = winRate - rules.autoBalance.targetWinRate;
    const rewardStep = Number(rules.autoBalance.rewardStep || 0);
    const penaltyStep = Number(rules.autoBalance.penaltyStep || 0);
    const next = { ...game };
    if (tweak > 0.08) {
      next.rewardMax = Math.max(next.rewardMin, next.rewardMax - rewardStep);
      next.lossPenalty = Math.min(999, next.lossPenalty + penaltyStep);
    } else if (tweak < -0.08) {
      next.rewardMax = Math.min(999, next.rewardMax + rewardStep);
      next.lossPenalty = Math.max(0, next.lossPenalty - penaltyStep);
    }
    nextRules.games[key] = next;
  }
  return nextRules;
}

export function getEffectiveRules(partyId) {
  const settings = getPartySettings(partyId);
  const overrides = jsonParse(settings?.tickets_rules, {});
  const merged = mergeRules(DEFAULT_TICKET_RULES, overrides);
  const sanitized = sanitizeRulesText(merged, DEFAULT_TICKET_RULES);
  sanitized.enabled = settings?.tickets_enabled == null ? true : !!settings.tickets_enabled;
  const normalized = normalizeRules(sanitized);
  return applyAutoBalance(getDb(), partyId, normalized);
}

export function saveRulesOverride(partyId, enabled, rules) {
  const nextEnabled = enabled == null ? 1 : enabled ? 1 : 0;
  setPartySettings(partyId, {
    tickets_enabled: nextEnabled,
    tickets_rules: JSON.stringify(rules || {})
  });
}
