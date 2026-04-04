import test from "node:test";
import assert from "node:assert/strict";
import {
  dmAdjustBodySchema,
  dmMetricsQuerySchema,
  dmQuestBodySchema,
  dmQuestResetBodySchema,
  dmRulesBodySchema,
  parseTicketRouteInput
} from "../src/tickets/routes/dmTicketRouteSchemas.js";

test("dm ticket route schemas coerce and trim valid payloads", () => {
  assert.deepEqual(parseTicketRouteInput(dmMetricsQuerySchema, { days: "7" }), {
    ok: true,
    data: { days: 7 }
  });
  assert.deepEqual(parseTicketRouteInput(dmQuestBodySchema, { questKey: " q-daily " }), {
    ok: true,
    data: { questKey: "q-daily" }
  });
  assert.deepEqual(parseTicketRouteInput(dmQuestResetBodySchema, { questKey: " q-daily ", dayKey: "20260404" }), {
    ok: true,
    data: { questKey: "q-daily", dayKey: 20260404 }
  });
  assert.deepEqual(parseTicketRouteInput(dmAdjustBodySchema, {
    playerId: "12",
    delta: "-5",
    reason: " reward "
  }), {
    ok: true,
    data: {
      playerId: 12,
      delta: -5,
      reason: "reward"
    }
  });
});

test("dm ticket route schemas reject malformed required fields", () => {
  assert.deepEqual(parseTicketRouteInput(dmRulesBodySchema, { enabled: "yes" }), {
    ok: false,
    error: "invalid_request"
  });
  assert.deepEqual(parseTicketRouteInput(dmQuestBodySchema, { questKey: "   " }), {
    ok: false,
    error: "invalid_request"
  });
  assert.deepEqual(parseTicketRouteInput(dmAdjustBodySchema, { playerId: "nope" }), {
    ok: false,
    error: "invalid_request"
  });
});
