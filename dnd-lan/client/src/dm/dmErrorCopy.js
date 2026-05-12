import { mapError } from "../lib/errorMapper.js";

function looksLikeSqliteError(value) {
  return String(value || "").toUpperCase().includes("SQLITE_");
}

export function formatDmSurfaceError(error, {
  subject = "Раздел",
  fallback = "Повторите попытку через несколько секунд."
} = {}) {
  const raw = String(error?.body?.error || error?.message || error || "").trim();
  if (looksLikeSqliteError(raw)) {
    return `${subject} сейчас недоступен: ошибка базы данных. Проверь сервер и состояние SQLite.`;
  }

  const mapped = mapError(error, "");
  if (mapped.message) {
    return mapped.hint ? `${mapped.message} ${mapped.hint}` : mapped.message;
  }

  return `${subject} сейчас недоступен. ${fallback}`;
}
