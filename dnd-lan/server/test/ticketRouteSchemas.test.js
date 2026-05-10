import test from "node:test";
import assert from "node:assert/strict";
import {
  matchCompleteBodySchema,
  matchHistoryQuerySchema,
  matchIdParamsSchema,
  parseTicketRouteInput,
  purchaseBodySchema,
  queueJoinBodySchema,
  sessionParamsSchema
} from "../src/tickets/routes/ticketRouteSchemas.js";

test("ticket route schemas coerce and trim valid inputs", () => {
  assert.deepEqual(parseTicketRouteInput(matchIdParamsSchema, { matchId: "42" }), {
    ok: true,
    data: { matchId: 42 }
  });
  assert.deepEqual(parseTicketRouteInput(matchHistoryQuerySchema, { limit: "7" }), {
    ok: true,
    data: { limit: 7 }
  });
  assert.deepEqual(parseTicketRouteInput(queueJoinBodySchema, {
    gameKey: " ttt ",
    modeKey: " normal ",
    skillBand: " rookie "
  }), {
    ok: true,
    data: {
      gameKey: "ttt",
      modeKey: "normal",
      skillBand: "rookie"
    }
  });
});

test("ticket route schemas reject malformed ids and empty required fields", () => {
  assert.deepEqual(parseTicketRouteInput(sessionParamsSchema, { sessionId: "not-a-session" }), {
    ok: false,
    error: "invalid_request"
  });
  assert.deepEqual(parseTicketRouteInput(matchCompleteBodySchema, { durationMs: "NaN" }), {
    ok: false,
    error: "invalid_request"
  });
  assert.deepEqual(parseTicketRouteInput(purchaseBodySchema, { itemKey: "" }), {
    ok: false,
    error: "invalid_request"
  });
});
