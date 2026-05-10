import { GAME_CATALOG } from "../../gameCatalog.js";
import { ARCADE_HISTORY_LIMIT, ARCADE_METRICS_DAYS } from "../shared/ticketConstants.js";
import { clampLimit, getDayKey } from "../shared/ticketUtils.js";
import { getEffectiveRules } from "./ticketRulesService.js";
import { buildTicketPayload, ensureTicketRow, normalizeDay } from "./ticketStateService.js";
import { buildDmArcadeMetrics, getMatchHistory } from "./matchmakingService.js";

function ok(body) {
  return { ok: true, status: 200, body };
}

function error(status, code) {
  return { ok: false, status, body: { error: code } };
}

export function getTicketRulesPayload({ partyId }) {
  return ok({ rules: getEffectiveRules(partyId) });
}

export function getTicketMePayload({ db, playerId, partyId, buildMatchmakingPayload }) {
  let row = ensureTicketRow(db, playerId);
  const dayKey = getDayKey();
  row = normalizeDay(db, row, dayKey);

  const rules = getEffectiveRules(partyId);
  return ok(buildTicketPayload(db, playerId, dayKey, rules, {
    partyId,
    buildMatchmakingPayload
  }));
}

export function getTicketCatalogPayload() {
  return ok({ catalog: GAME_CATALOG });
}

export function issueTicketSeedPayload({ playerId, gameKey, issueSeedFn }) {
  const safeGameKey = String(gameKey || "").trim();
  if (!safeGameKey || !GAME_CATALOG.find((game) => game.key === safeGameKey)) {
    return error(400, "invalid_game");
  }
  // This endpoint only gives one-shot replay protection. Games with client-visible seed
  // still need per-move server state APIs for full server-authoritative anti-cheat.
  const issued = issueSeedFn(playerId, safeGameKey);
  return ok({ seed: issued.seed, proof: issued.proof, gameKey: safeGameKey });
}

export function getTicketMatchHistoryPayload({ db, playerId, limit }) {
  const safeLimit = clampLimit(limit, ARCADE_HISTORY_LIMIT, 1, 50);
  return ok({ items: getMatchHistory(db, playerId, safeLimit) });
}

export function getDmTicketMetricsPayload({ db, partyId, days }) {
  const safeDays = clampLimit(days, ARCADE_METRICS_DAYS, 1, 30);
  return ok({ metrics: buildDmArcadeMetrics(db, partyId, safeDays) });
}
