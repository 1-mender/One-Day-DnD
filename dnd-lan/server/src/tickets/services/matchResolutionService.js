import { now } from "../../util.js";
import { logEvent } from "../../events.js";
import { clampLimit } from "../shared/ticketUtils.js";
import { loadMatchForPlayer } from "./matchmakingService.js";

function error(status, code) {
  return { ok: false, status, body: { error: code } };
}

export function processMatchCompletion({ db, io, me, matchId, body, nowFn = now }) {
  const safeMatchId = Number(matchId);
  if (!safeMatchId) return error(400, "invalid_match_id");

  const match = db.prepare("SELECT * FROM arcade_matches WHERE id=?").get(safeMatchId);
  if (!match) return error(404, "match_not_found");

  const participants = db.prepare(
    "SELECT player_id FROM arcade_match_players WHERE match_id=? ORDER BY player_id"
  ).all(safeMatchId).map((row) => Number(row.player_id));
  if (!participants.includes(Number(me.player.id))) return error(403, "forbidden");

  if (String(match.status) === "completed") {
    return {
      ok: true,
      status: 200,
      body: { ok: true, match: loadMatchForPlayer(db, safeMatchId, me.player.id) }
    };
  }

  const winnerPlayerIdInput = body?.winnerPlayerId == null ? null : Number(body.winnerPlayerId);
  const outcomeInputRaw = String(body?.outcome || "").trim().toLowerCase();
  const durationMsInput = body?.durationMs == null ? null : Number(body.durationMs);
  const durationMs = durationMsInput == null ? null : clampLimit(durationMsInput, 0, 0, 24 * 60 * 60 * 1000);
  const currentDurationMs = match.duration_ms == null ? null : Number(match.duration_ms);
  const mergedDurationMs = durationMs == null
    ? currentDurationMs
    : (currentDurationMs == null ? durationMs : Math.max(currentDurationMs, durationMs));
  const t = nowFn();

  if (winnerPlayerIdInput != null) return error(403, "winner_locked");
  if (!["win", "loss", "draw"].includes(outcomeInputRaw)) return error(400, "invalid_outcome");

  const selfRow = db.prepare(
    "SELECT player_id, result FROM arcade_match_players WHERE match_id=? AND player_id=?"
  ).get(safeMatchId, me.player.id);
  if (!selfRow) return error(403, "forbidden");

  if (selfRow.result !== "pending" && String(selfRow.result) !== outcomeInputRaw) {
    return error(409, "already_submitted");
  }
  if (selfRow.result === "pending") {
    db.prepare(
      "UPDATE arcade_match_players SET result=?, is_winner=? WHERE match_id=? AND player_id=?"
    ).run(outcomeInputRaw, outcomeInputRaw === "win" ? 1 : 0, safeMatchId, me.player.id);
  }
  if (durationMs != null) {
    db.prepare("UPDATE arcade_matches SET duration_ms=? WHERE id=?").run(mergedDurationMs, safeMatchId);
  }

  const results = db.prepare(
    "SELECT player_id, result FROM arcade_match_players WHERE match_id=? ORDER BY player_id"
  ).all(safeMatchId).map((row) => ({ playerId: Number(row.player_id), result: String(row.result || "pending") }));
  const pendingCount = results.filter((row) => row.result === "pending").length;
  if (pendingCount > 0) {
    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        awaitingOpponent: true,
        match: loadMatchForPlayer(db, safeMatchId, me.player.id)
      }
    };
  }

  const wins = results.filter((row) => row.result === "win");
  const losses = results.filter((row) => row.result === "loss");
  let winnerPlayerId = null;
  let loserPlayerId = null;
  let resolution = "draw";
  if (participants.length === 2 && wins.length === 1 && losses.length === 1) {
    winnerPlayerId = Number(wins[0].playerId);
    loserPlayerId = Number(losses[0].playerId);
    resolution = "win_loss";
  } else if (wins.length === 0 && losses.length === 0) {
    winnerPlayerId = null;
    loserPlayerId = null;
    resolution = "draw";
  } else {
    resolution = "conflict_draw";
    db.prepare("UPDATE arcade_match_players SET result='draw', is_winner=0 WHERE match_id=?").run(safeMatchId);
  }

  db.prepare(
    `UPDATE arcade_matches
     SET status='completed', ended_at=?, duration_ms=?, winner_player_id=?, loser_player_id=?
     WHERE id=?`
  ).run(t, mergedDurationMs, winnerPlayerId, loserPlayerId, safeMatchId);

  for (const playerId of participants) {
    io?.to(`player:${playerId}`).emit("arcade:match:state", {
      matchId: safeMatchId,
      status: "completed",
      winnerPlayerId,
      loserPlayerId,
      durationMs: mergedDurationMs
    });
    io?.to(`player:${playerId}`).emit("tickets:updated");
  }
  io?.to("dm").emit("tickets:updated");

  logEvent({
    partyId: Number(match.party_id),
    type: "arcade.match.completed",
    actorRole: "player",
    actorPlayerId: me.player.id,
    actorName: me.player.display_name,
    targetType: "arcade_match",
    targetId: safeMatchId,
    message: `Match ${safeMatchId} completed`,
    data: { matchId: safeMatchId, winnerPlayerId, loserPlayerId, durationMs: mergedDurationMs, resolution },
    io
  });

  return {
    ok: true,
    status: 200,
    body: { ok: true, match: loadMatchForPlayer(db, safeMatchId, me.player.id) }
  };
}
