import { now } from "../../util.js";
import { logEvent } from "../../events.js";
import { getDayKey } from "../shared/ticketUtils.js";
import { buildTicketPayload, ensureTicketRow, normalizeDay } from "./ticketStateService.js";
import { getEffectiveRules } from "./ticketRulesService.js";
import {
  cleanupExpiredQueue,
  emitQueueUpdated,
  getActiveQueueRow,
  queuePlayerForMatchmaking,
  resolveModeKey
} from "./matchmakingService.js";

function error(status, code) {
  return { ok: false, status, body: { error: code } };
}

export function processMatchmakingQueueJoin({ db, io, me, body, buildMatchmakingPayload }) {
  const gameKey = String(body?.gameKey || "").trim();
  const modeKeyInput = String(body?.modeKey || "").trim();
  const skillBand = String(body?.skillBand || "").trim().slice(0, 24);

  const rules = getEffectiveRules(me.player.party_id);
  if (!rules.enabled) return error(400, "tickets_disabled");
  const game = rules.games?.[gameKey];
  if (!game) return error(400, "invalid_game");
  if (game.enabled === false) return error(400, "game_disabled");

  const modeKey = resolveModeKey(gameKey, modeKeyInput);
  if (!modeKey) return error(400, "invalid_mode");

  let row = ensureTicketRow(db, me.player.id);
  const dayKey = getDayKey();
  row = normalizeDay(db, row, dayKey);

  const queued = queuePlayerForMatchmaking({
    db,
    io,
    me,
    gameKey,
    modeKey,
    skillBand
  });
  if (queued.error === "already_in_queue") {
    return error(409, "already_in_queue");
  }

  return {
    ok: true,
    status: 200,
    body: {
      ...buildTicketPayload(db, me.player.id, dayKey, rules, {
        partyId: me.player.party_id,
        buildMatchmakingPayload
      }),
      matchmakingAction: {
        status: queued.status,
        queueId: Number(queued.queueRow?.id || 0),
        matchId: queued.match ? Number(queued.match.id) : null
      }
    }
  };
}

export function processMatchmakingQueueCancel({ db, io, me, body, buildMatchmakingPayload, nowFn = now }) {
  const queueId = body?.queueId == null ? null : Number(body.queueId);
  cleanupExpiredQueue(db, me.player.party_id, io);

  const active = queueId
    ? db.prepare(
      "SELECT * FROM arcade_match_queue WHERE id=? AND player_id=? AND status='queued' LIMIT 1"
    ).get(queueId, me.player.id)
    : getActiveQueueRow(db, me.player.id);

  const dayKey = getDayKey();
  let row = ensureTicketRow(db, me.player.id);
  row = normalizeDay(db, row, dayKey);
  const rules = getEffectiveRules(me.player.party_id);

  if (!active) {
    return {
      ok: true,
      status: 200,
      body: {
        ...buildTicketPayload(db, me.player.id, dayKey, rules, {
          partyId: me.player.party_id,
          buildMatchmakingPayload
        }),
        matchmakingAction: { status: "noop" }
      }
    };
  }

  const t = nowFn();
  db.prepare(
    "UPDATE arcade_match_queue SET status='canceled', canceled_at=?, updated_at=? WHERE id=?"
  ).run(t, t, active.id);

  emitQueueUpdated(io, me.player.id);
  io?.to("dm").emit("tickets:updated");
  logEvent({
    partyId: me.player.party_id,
    type: "arcade.queue.cancel",
    actorRole: "player",
    actorPlayerId: me.player.id,
    actorName: me.player.display_name,
    targetType: "arcade_queue",
    targetId: Number(active.id),
    message: `Queue cancel ${active.game_key}/${active.mode_key}`,
    data: {
      queueId: Number(active.id),
      gameKey: String(active.game_key || ""),
      modeKey: String(active.mode_key || "")
    },
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
      matchmakingAction: { status: "canceled", queueId: Number(active.id) }
    }
  };
}

export function processMatchRematchRequest({ db, io, me, matchId, buildMatchmakingPayload }) {
  const safeMatchId = Number(matchId);
  if (!safeMatchId) return error(400, "invalid_match_id");

  const match = db.prepare("SELECT * FROM arcade_matches WHERE id=?").get(safeMatchId);
  if (!match) return error(404, "match_not_found");
  if (Number(match.party_id) !== Number(me.player.party_id)) return error(404, "match_not_found");

  const participantRows = db
    .prepare("SELECT player_id FROM arcade_match_players WHERE match_id=? ORDER BY player_id")
    .all(safeMatchId);
  const playerIds = participantRows.map((row) => Number(row.player_id));
  if (!playerIds.includes(Number(me.player.id))) {
    return error(403, "forbidden");
  }
  const opponentId = playerIds.find((id) => id !== Number(me.player.id)) || null;
  if (!opponentId) return error(400, "opponent_not_found");

  let row = ensureTicketRow(db, me.player.id);
  const dayKey = getDayKey();
  row = normalizeDay(db, row, dayKey);
  const rules = getEffectiveRules(me.player.party_id);
  const game = rules.games?.[String(match.game_key || "")];
  if (!game || game.enabled === false) return error(400, "game_disabled");

  const queued = queuePlayerForMatchmaking({
    db,
    io,
    me,
    gameKey: String(match.game_key || ""),
    modeKey: String(match.mode_key || ""),
    rematchTargetPlayerId: opponentId,
    rematchOfMatchId: safeMatchId
  });
  if (queued.error === "already_in_queue") {
    return error(409, "already_in_queue");
  }

  logEvent({
    partyId: me.player.party_id,
    type: "arcade.match.rematch_request",
    actorRole: "player",
    actorPlayerId: me.player.id,
    actorName: me.player.display_name,
    targetType: "arcade_match",
    targetId: safeMatchId,
    message: `Rematch requested for match ${safeMatchId}`,
    data: {
      matchId: safeMatchId,
      gameKey: String(match.game_key || ""),
      modeKey: String(match.mode_key || ""),
      opponentId
    },
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
      matchmakingAction: {
        status: queued.status,
        queueId: Number(queued.queueRow?.id || 0),
        matchId: queued.match ? Number(queued.match.id) : null
      }
    }
  };
}
