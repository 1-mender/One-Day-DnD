import { logger } from "../../logger.js";
import { logEvent } from "../../events.js";
import {
  makePlayClientProof,
  randInt,
  validateGuessPayload,
  validateDicePayload,
  validateMatch3Payload,
  validateScrabblePayload,
  validateTttPayload
} from "../domain/playValidation.js";
import { MIN_ARCADE_PLAY_MS } from "../shared/ticketConstants.js";
import { getDayKey, isPlainObject } from "../shared/ticketUtils.js";
import { maybeGrantDailyQuest } from "./dailyQuestService.js";
import { buildTicketPayload, ensureTicketRow, normalizeDay } from "./ticketStateService.js";
import { getEffectiveRules } from "./ticketRulesService.js";

function error(status, code) {
  return { ok: false, status, body: { error: code } };
}

export function processTicketPlay({ db, io, me, body, takeSeed, nowFn, buildMatchmakingPayload }) {
  const gameKey = String(body?.gameKey || "").trim();
  const outcome = String(body?.outcome || "").trim().toLowerCase();
  const performanceKey = String(body?.performance || "normal").trim();
  const seed = body?.seed ? String(body.seed) : "";
  const payload = body?.payload;
  const proof = body?.proof ? String(body.proof) : "";
  const clientProof = body?.clientProof ? String(body.clientProof) : "";

  const rules = getEffectiveRules(me.player.party_id);
  if (!rules.enabled) return error(400, "tickets_disabled");
  const game = rules.games?.[gameKey];
  if (!game) return error(400, "invalid_game");
  if (game.enabled === false) return error(400, "game_disabled");
  if (!["win", "loss"].includes(outcome)) return error(400, "invalid_outcome");
  if (outcome === "loss" && performanceKey !== "normal") return error(400, "invalid_proof");
  if (!isPlainObject(payload)) return error(400, "invalid_proof");
  if (!seed || !proof) return error(400, "invalid_seed");

  const seedTicket = takeSeed(me.player.id, gameKey, seed, proof);
  if (!seedTicket) return error(400, "invalid_seed");

  const expectedClientProof = makePlayClientProof(seed, {
    gameKey,
    outcome,
    performance: performanceKey,
    payload
  });
  if (!clientProof || clientProof !== expectedClientProof) return error(400, "invalid_proof");

  const elapsedMs = Math.max(0, nowFn() - Number(seedTicket?.issuedAt || 0));
  const minPlayMs = Number(MIN_ARCADE_PLAY_MS[gameKey] || 0);
  if (outcome === "win" && minPlayMs > 0 && elapsedMs < minPlayMs) return error(400, "invalid_proof");

  if (gameKey === "guess" && !validateGuessPayload({ ...payload, outcome }, seed || "")) return error(400, "invalid_proof");
  if (gameKey === "ttt" && !validateTttPayload({ ...payload, outcome })) return error(400, "invalid_proof");
  if (gameKey === "match3" && !validateMatch3Payload(payload, outcome, performanceKey)) return error(400, "invalid_proof");
  if (gameKey === "dice" && !validateDicePayload(payload, outcome, performanceKey, seed || "")) return error(400, "invalid_proof");
  if (gameKey === "scrabble" && !validateScrabblePayload(payload, outcome, performanceKey)) return error(400, "invalid_proof");

  let row = ensureTicketRow(db, me.player.id);
  const dayKey = getDayKey();
  row = normalizeDay(db, row, dayKey);

  const playsToday = db
    .prepare("SELECT COUNT(*) as c FROM ticket_plays WHERE player_id=? AND day_key=? AND game_key=?")
    .get(me.player.id, dayKey, gameKey)?.c || 0;
  if (game.dailyLimit && playsToday >= game.dailyLimit) return error(400, "daily_game_limit");

  const entryCost = Number(game.entryCost || 0);
  if (entryCost > 0 && row.balance < entryCost) return error(400, "not_enough_tickets");

  const lossPenalty = Number(game.lossPenalty || 0);
  const spendCap = Number(rules.dailySpendCap || 0);
  const currentSpent = Number(row.daily_spent || 0);
  if (spendCap > 0) {
    const projectedSpend = currentSpent + entryCost + (outcome === "loss" ? lossPenalty : 0);
    if (projectedSpend > spendCap) return error(400, "daily_spend_cap");
  }

  let balance = Number(row.balance || 0) - entryCost;
  let dailyEarned = Number(row.daily_earned || 0);
  let dailySpent = currentSpent + entryCost;
  let streakAfter = Number(row.streak || 0);
  let reward = 0;
  let penalty = 0;
  let baseReward = 0;
  let multiplier = 1;

  if (outcome === "win") {
    const perf = game.performance?.[performanceKey];
    if (!perf) return error(400, "invalid_performance");

    baseReward = randInt(game.rewardMin, game.rewardMax);
    streakAfter += 1;

    const streakBonusCount = Math.min(streakAfter, rules.streak.max);
    const streakMultiplier = 1 + Math.min(streakAfter - 1, rules.streak.max) * rules.streak.step;
    const perfMultiplier = Number(perf.multiplier || 1);
    multiplier = Number((streakMultiplier * perfMultiplier).toFixed(2));

    reward = Math.round(baseReward * multiplier + streakBonusCount * (rules.streak.flatBonus || 0));

    if (rules.dailyEarnCap && rules.dailyEarnCap > 0) {
      const remaining = Math.max(0, rules.dailyEarnCap - dailyEarned);
      if (reward > remaining) reward = remaining;
    }

    balance += reward;
    dailyEarned += reward;
  } else {
    penalty = lossPenalty;
    balance = Math.max(0, balance - penalty);
    dailySpent += penalty;
    streakAfter = 0;
  }

  const t = nowFn();
  db.prepare(
    "UPDATE tickets SET balance=?, streak=?, daily_earned=?, daily_spent=?, last_played_at=?, updated_at=? WHERE player_id=?"
  ).run(balance, streakAfter, dailyEarned, dailySpent, t, t, me.player.id);

  db.prepare(
    "INSERT INTO ticket_plays(player_id, game_key, outcome, entry_cost, reward, penalty, multiplier, streak_after, day_key, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)"
  ).run(me.player.id, gameKey, outcome, entryCost, reward, penalty, multiplier, streakAfter, dayKey, t);

  try {
    maybeGrantDailyQuest(db, me.player.id, dayKey, rules);
  } catch (e) {
    logger.error({ err: e, playerId: me.player.id, dayKey }, "daily quest reward failed");
  }

  io?.to(`player:${me.player.id}`).emit("tickets:updated");
  io?.to("dm").emit("tickets:updated");

  logEvent({
    partyId: me.player.party_id,
    type: "tickets.play",
    actorRole: "player",
    actorPlayerId: me.player.id,
    actorName: me.player.display_name,
    targetType: "player",
    targetId: me.player.id,
    message: `Game ${gameKey}: ${outcome} (entry ${entryCost}, reward ${reward}, penalty ${penalty})`,
    data: { gameKey, outcome, entryCost, reward, penalty, multiplier, streakAfter },
    io
  });

  return {
    ok: true,
    status: 200,
    body: {
      ...buildTicketPayload(db, me.player.id, dayKey, rules, {
        partyId: me.player.party_id,
        buildMatchmakingPayload
      }),
      result: {
        gameKey,
        outcome,
        entryCost,
        reward,
        penalty,
        baseReward,
        multiplier,
        streakAfter
      }
    }
  };
}
