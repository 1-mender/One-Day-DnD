import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDurationMs,
  formatTicketError,
  isGameLimitReached
} from "./arcadeFormatters.js";

test("formatDurationMs formats seconds and minutes", () => {
  assert.equal(formatDurationMs(9000), "9 с");
  assert.equal(formatDurationMs(125000), "2 мин 05 с");
});

test("formatTicketError maps known code and sanitizes unknown", () => {
  assert.equal(formatTicketError("invalid_mode"), "Выбранный режим недоступен.");
  assert.equal(formatTicketError("custom_error"), "Не удалось выполнить действие в аркаде.");
});

test("isGameLimitReached checks per-game limit", () => {
  const rules = { games: { ttt: { dailyLimit: 3 } } };
  const usage = { playsToday: { ttt: 3 } };
  assert.equal(isGameLimitReached("ttt", rules, usage), true);
  assert.equal(isGameLimitReached("guess", rules, usage), false);
});
