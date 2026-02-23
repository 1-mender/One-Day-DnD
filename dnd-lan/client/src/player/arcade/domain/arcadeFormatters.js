export function impactClass(label) {
  const v = String(label || "").toLowerCase();
  if (v.includes("слож") || v.includes("hard") || v.includes("high") || v.includes("высок")) return "impact-high";
  if (v.includes("сред") || v.includes("mid") || v.includes("medium")) return "impact-mid";
  if (v.includes("лег") || v.includes("easy") || v.includes("низ")) return "impact-low";
  return "impact-low";
}

export function formatEntry(entry) {
  const qty = Number(entry || 0);
  if (!qty) return "Вход: бесплатно";
  return `Вход: ${qty} ${qty === 1 ? "билет" : qty < 5 ? "билета" : "билетов"}`;
}

export function formatDayKey(dayKey) {
  const n = Number(dayKey);
  if (!Number.isFinite(n) || n <= 0) return String(dayKey || "");
  const d = new Date(n * 24 * 60 * 60 * 1000);
  const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = months[d.getUTCMonth()] || "";
  return month ? `${day} ${month}` : day;
}

export function formatDurationMs(ms) {
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function formatTicketError(code) {
  const c = String(code || "");
  if (c === "tickets_disabled") return "Аркада временно закрыта.";
  if (c === "game_disabled") return "Эта игра сейчас закрыта.";
  if (c === "not_enough_tickets") return "Недостаточно билетов для входа.";
  if (c === "daily_game_limit") return "Достигнут дневной лимит попыток.";
  if (c === "daily_spend_cap") return "Достигнут дневной лимит трат.";
  if (c === "invalid_performance") return "Неверный бонус выполнения.";
  if (c === "invalid_seed") return "Сессия игры устарела. Откройте игру снова.";
  if (c === "invalid_proof") return "Результат игры не прошёл проверку.";
  if (c === "invalid_game") return "Эта игра недоступна.";
  if (c === "invalid_mode") return "Выбранный режим недоступен.";
  if (c === "invalid_outcome") return "Некорректный результат матча.";
  if (c === "already_in_queue") return "Вы уже в очереди.";
  if (c === "already_submitted") return "Результат уже отправлен.";
  if (c === "match_not_found") return "Матч не найден.";
  if (c === "opponent_not_found") return "Соперник не найден.";
  if (c === "winner_locked") return "Победитель уже зафиксирован.";
  if (c === "forbidden") return "Действие недоступно.";
  return c || "Ошибка";
}

export function isGameLimitReached(gameKey, rules, usage) {
  const lim = rules?.games?.[gameKey]?.dailyLimit;
  if (!lim) return false;
  const used = usage?.playsToday?.[gameKey] || 0;
  return used >= lim;
}
