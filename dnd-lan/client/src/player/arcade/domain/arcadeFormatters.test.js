import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDurationMs,
  formatTicketError,
  isGameLimitReached
} from "./arcadeFormatters.js";

test("formatDurationMs formats seconds and minutes", () => {
  assert.equal(formatDurationMs(9000), "9s");
  assert.equal(formatDurationMs(125000), "2m 05s");
});

test("formatTicketError maps known code and keeps unknown", () => {
  assert.equal(formatTicketError("invalid_mode"), "Selected mode is not available.");
  assert.equal(formatTicketError("custom_error"), "custom_error");
});

test("isGameLimitReached checks per-game limit", () => {
  const rules = { games: { ttt: { dailyLimit: 3 } } };
  const usage = { playsToday: { ttt: 3 } };
  assert.equal(isGameLimitReached("ttt", rules, usage), true);
  assert.equal(isGameLimitReached("guess", rules, usage), false);
});
