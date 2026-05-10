import { now } from "../../util.js";
import { logEvent } from "../../events.js";
import { GAME_CATALOG } from "../../gameCatalog.js";
import {
  ARCADE_HISTORY_LIMIT,
  ARCADE_METRICS_DAYS,
  ARCADE_QUEUE_ETA_SEC,
  ARCADE_QUEUE_TTL_MS,
  DAY_MS
} from "../shared/ticketConstants.js";
import { clampLimit, summarizeStats } from "../shared/ticketUtils.js";

function getCatalogGame(gameKey) {
  return GAME_CATALOG.find((g) => g.key === gameKey) || null;
}

export function resolveModeKey(gameKey, modeKey) {
  const game = getCatalogGame(gameKey);
  if (!game) return null;
  const modes = Array.isArray(game.modes) ? game.modes : [];
  if (!modes.length) return modeKey || "default";
  const safe = String(modeKey || "").trim();
  if (!safe) return String(modes[0].key || "default");
  const found = modes.find((m) => String(m.key) === safe);
  if (!found) return null;
  return safe;
}

function compactMatchPayload(row, playerId, opponentName = "") {
  if (!row) return null;
  const winnerId = row.winner_player_id == null ? null : Number(row.winner_player_id);
  const loserId = row.loser_player_id == null ? null : Number(row.loser_player_id);
  let result = "pending";
  if (winnerId && winnerId === Number(playerId)) result = "win";
  else if (loserId && loserId === Number(playerId)) result = "loss";
  else if (row.status === "completed") result = "draw";
  return {
    matchId: Number(row.id),
    gameKey: String(row.game_key || ""),
    modeKey: String(row.mode_key || ""),
    status: String(row.status || "pending"),
    result,
    opponentName: opponentName || "",
    createdAt: Number(row.created_at || 0),
    startedAt: row.started_at == null ? null : Number(row.started_at),
    endedAt: row.ended_at == null ? null : Number(row.ended_at),
    queueWaitMs: row.queue_wait_ms == null ? null : Number(row.queue_wait_ms),
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    rematchOf: row.rematch_of == null ? null : Number(row.rematch_of)
  };
}

export function emitQueueUpdated(io, playerId) {
  if (!io || !playerId) return;
  io.to(`player:${playerId}`).emit("arcade:queue:updated");
}

export function cleanupExpiredQueue(db, partyId, io = null) {
  const t = now();
  const rows = db
    .prepare("SELECT id, player_id FROM arcade_match_queue WHERE party_id=? AND status='queued' AND expires_at<=?")
    .all(partyId, t);
  if (!rows.length) return 0;

  const tx = db.transaction(() => {
    for (const row of rows) {
      db.prepare(
        "UPDATE arcade_match_queue SET status='expired', updated_at=? WHERE id=? AND status='queued'"
      ).run(t, row.id);
    }
  });
  tx();

  for (const row of rows) {
    emitQueueUpdated(io, Number(row.player_id));
  }
  return rows.length;
}

export function getActiveQueueRow(db, playerId) {
  return db
    .prepare("SELECT * FROM arcade_match_queue WHERE player_id=? AND status='queued' ORDER BY joined_at DESC LIMIT 1")
    .get(playerId);
}

export function getMatchHistory(db, playerId, limit = ARCADE_HISTORY_LIMIT) {
  const lim = clampLimit(limit, ARCADE_HISTORY_LIMIT, 1, 50);
  const rows = db.prepare(
    `SELECT m.*
     FROM arcade_match_players mp
     JOIN arcade_matches m ON m.id = mp.match_id
     WHERE mp.player_id=?
     ORDER BY m.created_at DESC
     LIMIT ?`
  ).all(playerId, lim);

  return rows.map((row) => {
    const opponent = db.prepare(
      `SELECT p.display_name as displayName
       FROM arcade_match_players mp
       JOIN players p ON p.id = mp.player_id
       WHERE mp.match_id=? AND mp.player_id<>?
       LIMIT 1`
    ).get(row.id, playerId);
    return compactMatchPayload(row, playerId, String(opponent?.displayName || ""));
  });
}

export function buildMatchmakingPayload(db, playerId, partyId) {
  cleanupExpiredQueue(db, partyId);
  const active = getActiveQueueRow(db, playerId);
  const history = getMatchHistory(db, playerId, ARCADE_HISTORY_LIMIT);
  const activeQueue = active
    ? {
      id: Number(active.id),
      gameKey: String(active.game_key || ""),
      modeKey: String(active.mode_key || ""),
      skillBand: active.skill_band == null ? null : String(active.skill_band),
      joinedAt: Number(active.joined_at || 0),
      expiresAt: Number(active.expires_at || 0),
      waitMs: Math.max(0, now() - Number(active.joined_at || now())),
      etaSec: ARCADE_QUEUE_ETA_SEC,
      rematchTargetPlayerId: active.rematch_target_player_id == null ? null : Number(active.rematch_target_player_id),
      rematchOfMatchId: active.rematch_of_match_id == null ? null : Number(active.rematch_of_match_id)
    }
    : null;
  return { activeQueue, history };
}

function findQueueOpponent(db, { partyId, playerId, gameKey, modeKey, rematchTargetPlayerId, skillBand }) {
  const safeSkillBand = String(skillBand || "").trim();
  const skillBandClause = safeSkillBand ? "AND skill_band=?" : "";
  const skillBandArgs = safeSkillBand ? [safeSkillBand] : [];

  if (rematchTargetPlayerId) {
    const exact = db.prepare(
      `SELECT *
       FROM arcade_match_queue
       WHERE party_id=? AND status='queued' AND player_id=? AND game_key=? AND mode_key=?
         AND (rematch_target_player_id IS NULL OR rematch_target_player_id=?)
         ${skillBandClause}
       ORDER BY joined_at ASC
       LIMIT 1`
    ).get(partyId, rematchTargetPlayerId, gameKey, modeKey, playerId, ...skillBandArgs);
    if (exact) return exact;
  }

  return db.prepare(
    `SELECT *
     FROM arcade_match_queue
     WHERE party_id=? AND status='queued' AND player_id<>? AND game_key=? AND mode_key=?
       AND (rematch_target_player_id IS NULL OR rematch_target_player_id=?)
       ${skillBandClause}
     ORDER BY CASE WHEN rematch_target_player_id=? THEN 0 ELSE 1 END, joined_at ASC
     LIMIT 1`
  ).get(partyId, playerId, gameKey, modeKey, playerId, ...skillBandArgs, playerId);
}

function createMatchFromQueues(db, {
  partyId,
  gameKey,
  modeKey,
  queueA,
  queueB,
  createdAt,
  rematchOfMatchId
}) {
  const waitBase = Math.min(Number(queueA?.joined_at || createdAt), Number(queueB?.joined_at || createdAt));
  const queueWaitMs = Math.max(0, createdAt - waitBase);

  const matchInfo = db.prepare(
    `INSERT INTO arcade_matches(
      party_id, game_key, mode_key, status, created_at, started_at, queue_wait_ms, rematch_of
    ) VALUES(?,?,?,?,?,?,?,?)`
  ).run(
    partyId,
    gameKey,
    modeKey,
    "active",
    createdAt,
    createdAt,
    queueWaitMs,
    rematchOfMatchId || null
  );
  const matchId = Number(matchInfo.lastInsertRowid);

  db.prepare(
    `INSERT INTO arcade_match_players(match_id, player_id, queue_id, joined_at, result, is_winner)
     VALUES(?,?,?,?,?,?)`
  ).run(matchId, Number(queueA.player_id), Number(queueA.id), createdAt, "pending", 0);
  db.prepare(
    `INSERT INTO arcade_match_players(match_id, player_id, queue_id, joined_at, result, is_winner)
     VALUES(?,?,?,?,?,?)`
  ).run(matchId, Number(queueB.player_id), Number(queueB.id), createdAt, "pending", 0);

  db.prepare(
    "UPDATE arcade_match_queue SET status='matched', matched_at=?, updated_at=?, match_id=? WHERE id IN (?,?)"
  ).run(createdAt, createdAt, matchId, Number(queueA.id), Number(queueB.id));

  return db.prepare("SELECT * FROM arcade_matches WHERE id=?").get(matchId);
}

export function loadMatchForPlayer(db, matchId, playerId) {
  const row = db.prepare("SELECT * FROM arcade_matches WHERE id=?").get(matchId);
  if (!row) return null;
  const opponent = db.prepare(
    `SELECT p.display_name as displayName
     FROM arcade_match_players mp
     JOIN players p ON p.id = mp.player_id
     WHERE mp.match_id=? AND mp.player_id<>?
     LIMIT 1`
  ).get(matchId, playerId);
  return compactMatchPayload(row, playerId, String(opponent?.displayName || ""));
}

export function emitMatchFound(io, db, matchId, players) {
  if (!io) return;
  const uniquePlayers = Array.from(new Set((players || []).map((v) => Number(v)).filter(Boolean)));
  for (const playerId of uniquePlayers) {
    const payload = loadMatchForPlayer(db, matchId, playerId);
    io.to(`player:${playerId}`).emit("arcade:match:found", { match: payload });
    emitQueueUpdated(io, playerId);
  }
  io.to("dm").emit("tickets:updated");
}

export function buildDmArcadeMetrics(db, partyId, days = ARCADE_METRICS_DAYS) {
  const windowDays = clampLimit(days, ARCADE_METRICS_DAYS, 1, 30);
  const since = now() - windowDays * DAY_MS;

  const queueRows = db
    .prepare("SELECT queue_wait_ms FROM arcade_matches WHERE party_id=? AND created_at>=? AND queue_wait_ms IS NOT NULL")
    .all(partyId, since);
  const durationRows = db
    .prepare("SELECT duration_ms FROM arcade_matches WHERE party_id=? AND created_at>=? AND duration_ms IS NOT NULL")
    .all(partyId, since);
  const allMatches = db
    .prepare("SELECT id, rematch_of FROM arcade_matches WHERE party_id=? AND created_at>=?")
    .all(partyId, since);

  const rematchCount = allMatches.filter((m) => m.rematch_of != null).length;
  const matchCount = allMatches.length;

  const activityRows = db.prepare(
    `SELECT player_id as playerId, COUNT(DISTINCT day_key) as d
     FROM ticket_plays tp
     JOIN players p ON p.id = tp.player_id
     WHERE tp.created_at>=? AND p.party_id=?
     GROUP BY player_id`
  ).all(since, partyId);
  const activePlayers = activityRows.length;
  const returningPlayers = activityRows.filter((r) => Number(r.d || 0) >= 2).length;

  return {
    windowDays,
    queueWaitMs: summarizeStats(queueRows.map((r) => r.queue_wait_ms)),
    matchCompleteMs: summarizeStats(durationRows.map((r) => r.duration_ms)),
    rematchRate: matchCount ? Number((rematchCount / matchCount).toFixed(2)) : 0,
    d1ReturnRate: activePlayers ? Number((returningPlayers / activePlayers).toFixed(2)) : 0
  };
}

export function queuePlayerForMatchmaking({
  db,
  io,
  me,
  gameKey,
  modeKey,
  skillBand = "",
  rematchTargetPlayerId = null,
  rematchOfMatchId = null
}) {
  const partyId = Number(me.player.party_id);
  cleanupExpiredQueue(db, partyId, io);

  const existing = getActiveQueueRow(db, me.player.id);
  if (existing) {
    return { error: "already_in_queue", existing };
  }

  const t = now();
  const expiresAt = t + Math.max(15_000, ARCADE_QUEUE_TTL_MS);
  const info = db.prepare(
    `INSERT INTO arcade_match_queue(
      party_id, player_id, game_key, mode_key, skill_band, rematch_target_player_id,
      rematch_of_match_id, status, joined_at, expires_at, updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    partyId,
    me.player.id,
    gameKey,
    modeKey,
    skillBand || null,
    rematchTargetPlayerId || null,
    rematchOfMatchId || null,
    "queued",
    t,
    expiresAt,
    t
  );

  const queueRow = db.prepare("SELECT * FROM arcade_match_queue WHERE id=?").get(info.lastInsertRowid);
  const opponent = findQueueOpponent(db, {
    partyId,
    playerId: me.player.id,
    gameKey,
    modeKey,
    rematchTargetPlayerId,
    skillBand
  });

  logEvent({
    partyId,
    type: "arcade.queue.join",
    actorRole: "player",
    actorPlayerId: me.player.id,
    actorName: me.player.display_name,
    targetType: "arcade_queue",
    targetId: Number(queueRow.id),
    message: `Queue join ${gameKey}/${modeKey}`,
    data: {
      queueId: Number(queueRow.id),
      gameKey,
      modeKey,
      skillBand: skillBand || null,
      rematchTargetPlayerId: rematchTargetPlayerId || null
    },
    io
  });

  if (!opponent) {
    emitQueueUpdated(io, me.player.id);
    return { status: "queued", queueRow, match: null };
  }

  const nextMatch = createMatchFromQueues(db, {
    partyId,
    gameKey,
    modeKey,
    queueA: queueRow,
    queueB: opponent,
    createdAt: t,
    rematchOfMatchId: rematchOfMatchId || opponent.rematch_of_match_id || queueRow.rematch_of_match_id
  });

  const opponentPlayer = db.prepare("SELECT display_name FROM players WHERE id=?").get(opponent.player_id);
  const waitMs = Math.max(0, t - Math.min(Number(queueRow.joined_at || t), Number(opponent.joined_at || t)));
  logEvent({
    partyId,
    type: "arcade.match.found",
    actorRole: "system",
    actorName: "Matchmaker",
    targetType: "arcade_match",
    targetId: Number(nextMatch.id),
    message: `Match found ${gameKey}/${modeKey}`,
    data: {
      matchId: Number(nextMatch.id),
      gameKey,
      modeKey,
      queueWaitMs: waitMs,
      players: [me.player.id, Number(opponent.player_id)],
      rematchOf: nextMatch.rematch_of == null ? null : Number(nextMatch.rematch_of),
      opponentName: String(opponentPlayer?.display_name || "")
    },
    io
  });

  emitMatchFound(io, db, Number(nextMatch.id), [me.player.id, Number(opponent.player_id)]);
  return { status: "matched", queueRow, match: nextMatch, opponent };
}
