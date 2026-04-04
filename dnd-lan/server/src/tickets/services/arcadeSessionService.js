import { processTicketPlay } from "./ticketPlayService.js";

function ok(body) {
  return { ok: true, status: 200, body };
}

function error(status, code) {
  return { ok: false, status, body: { error: code } };
}

function mapSessionError(code) {
  const normalized = String(code || "");
  if (normalized === "invalid_session") return error(404, "invalid_session");
  if (normalized === "unsupported_game") return error(400, "unsupported_game");
  if (normalized === "invalid_move") return error(400, "invalid_move");
  if (normalized === "game_already_finished") return error(400, "game_already_finished");
  if (normalized === "game_not_finished") return error(400, "game_not_finished");
  return error(400, normalized || "invalid_session");
}

export function processArcadeSessionStart({ me, gameKey, body, startSession }) {
  const result = startSession(me.player.id, gameKey, body);
  if (result?.error) return mapSessionError(result.error);
  return ok({ arcadeSession: result.snapshot });
}

export function processArcadeSessionMove({ me, sessionId, body, moveSession }) {
  const result = moveSession(me.player.id, sessionId, body);
  if (result?.error) return mapSessionError(result.error);
  return ok({ arcadeSession: result.snapshot });
}

export function processArcadeSessionFinish({
  db,
  io,
  me,
  sessionId,
  finishSession,
  deleteSession,
  nowFn,
  buildMatchmakingPayload
}) {
  const result = finishSession(me.player.id, sessionId);
  if (result?.error) return mapSessionError(result.error);

  const settled = processTicketPlay({
    db,
    io,
    me,
    body: result.playBody,
    nowFn,
    buildMatchmakingPayload,
    takeSeed: (playerId, gameKey, seed, proof) => {
      const issued = result.issuedSeed;
      if (Number(playerId) !== Number(me.player.id)) return false;
      if (String(gameKey || "") !== String(result.playBody?.gameKey || "")) return false;
      if (String(seed || "") !== String(issued?.seed || "")) return false;
      if (String(proof || "") !== String(issued?.proof || "")) return false;
      return {
        seed: String(issued.seed || ""),
        proof: String(issued.proof || ""),
        issuedAt: Number(issued.issuedAt || 0),
        expiresAt: Number(issued.expiresAt || 0)
      };
    }
  });

  if (!settled.ok) return settled;
  deleteSession?.(me.player.id, sessionId);
  return ok({
    ...settled.body,
    arcadeSession: result.snapshot
  });
}
