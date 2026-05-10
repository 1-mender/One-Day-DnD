import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDurationMs,
  formatTicketAmount,
  formatTicketError,
  isGameLimitReached
} from "./arcadeFormatters.js";

test("formatDurationMs formats seconds and minutes", () => {
  assert.equal(formatDurationMs(9000), "9 с");
  assert.equal(formatDurationMs(125000), "2 мин 05 с");
});

test("formatTicketError maps known code and sanitizes unknown", () => {
  assert.equal(formatTicketError("invalid_mode"), "Выбранный режим недоступен.");
  assert.equal(
    formatTicketError("minigame_inactive"),
    "Аркада не открыта для запуска. Обновите страницу или попросите DM открыть доступ."
  );
  assert.equal(formatTicketError("custom_error"), "Не удалось выполнить действие в аркаде.");
});

test("formatTicketAmount uses Russian plural forms", () => {
  assert.equal(formatTicketAmount(1), "1 билет");
  assert.equal(formatTicketAmount(3), "3 билета");
  assert.equal(formatTicketAmount(12), "12 билетов");
  assert.equal(formatTicketAmount(21), "21 билет");
});

test("isGameLimitReached checks per-game limit", () => {
  const rules = { games: { ttt: { dailyLimit: 3 } } };
  const usage = { playsToday: { ttt: 3 } };
  assert.equal(isGameLimitReached("ttt", rules, usage), true);
  assert.equal(isGameLimitReached("guess", rules, usage), false);
});
