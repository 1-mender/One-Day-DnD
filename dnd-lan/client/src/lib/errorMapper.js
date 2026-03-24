import { ERROR_CODES, ERROR_MESSAGES_RU } from "./errorCodes.js";

const CODE_RE = /^[a-z0-9_]+$/;
const CYRILLIC_RE = /[А-Яа-яЁё]/;

const ERROR_HINTS_RU = {
  offline: "Проверьте Wi‑Fi/LAN и доступность сервера, затем повторите.",
  read_only: "Дождитесь восстановления сервера или отключите режим read-only у DM.",
  request_timeout: "Проверьте стабильность сети и повторите запрос.",
  request_failed: "Повторите действие через несколько секунд.",
  not_authenticated: "Войдите в систему заново.",
  player_token_required: "Переподключитесь к партии через экран входа.",
  bad_credentials: "Проверьте логин и пароль DM.",
  bad_join_code: "Уточните код партии у мастера.",
  requests_disabled: "Дождитесь, пока мастер снова включит приём заявок.",
  forbidden: "Проверьте права доступа для текущей роли.",
  rate_limited: "Сделайте паузу и повторите немного позже.",
  payload_too_large: "Уменьшите размер данных или файла и повторите.",
  unsupported_file_type: "Используйте поддерживаемый формат файла.",
  file_too_large: "Сожмите файл или загрузите меньший по размеру.",
  file_required: "Выберите файл и повторите загрузку.",
  invalid_input: "Проверьте заполнение полей и формат значений.",
  not_ready: "Подождите завершения инициализации сервера.",
  field_not_allowed: "Изменение этого поля нужно согласовать с мастером.",
  profile_not_created: "Сначала создайте профиль персонажа.",
  server_error: "Повторите попытку или проверьте логи сервера.",
  image_limit_reached: "Удалите лишние изображения или выберите другого монстра.",
  monster_not_found: "Обновите список и откройте монстра заново.",
  invalid_monsterid: "Попробуйте открыть монстра заново и повторить загрузку.",
  invalid_slot: "Проверьте целевой слот и повторите действие.",
  inventory_full: "Освободите место в инвентаре и повторите действие.",
  slot_occupied: "Выберите свободный слот или сначала переместите предмет из него.",
  selected_players_required: "Отметьте получателей в списке перед сохранением.",
  invalid_equipment_slot: "Для этого предмета нужен совместимый слот экипировки.",
  not_equipable: "Предмет не относится к экипируемым типам.",
  invalid_qty: "Проверьте количество и повторите.",
  reserved_qty_exceeded: "Сначала завершите/отмените связанные передачи предмета."
};

function normalize(raw) {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (raw instanceof Error) return String(raw.message || "").trim();
  return String(raw).trim();
}

function inferCode(value) {
  const lowered = value.toLowerCase();
  if (ERROR_MESSAGES_RU[lowered]) return lowered;
  if (lowered.includes("failed to fetch") || lowered.includes("networkerror")) return ERROR_CODES.OFFLINE;
  if (lowered === "aborterror" || lowered.includes("timeout")) return ERROR_CODES.REQUEST_TIMEOUT;
  if (CODE_RE.test(lowered)) return lowered;
  return "";
}

function resolveMessage(code, raw) {
  if (code && ERROR_MESSAGES_RU[code]) return ERROR_MESSAGES_RU[code];
  if (CYRILLIC_RE.test(raw)) return raw;
  return "";
}

export function mapError(error, fallback = ERROR_CODES.REQUEST_FAILED) {
  const fallbackRaw = normalize(fallback);
  const variants = [
    error?.body?.error,
    error?.error,
    error?.message,
    error,
    fallbackRaw
  ];

  for (const variant of variants) {
    const raw = normalize(variant);
    if (!raw) continue;
    const code = inferCode(raw);
    const message = resolveMessage(code, raw);
    if (!message) continue;
    return {
      code: code || "",
      message,
      hint: ERROR_HINTS_RU[code] || ""
    };
  }

  if (!fallbackRaw) {
    return { code: "", message: "", hint: "" };
  }

  const fallbackCode = inferCode(fallbackRaw) || ERROR_CODES.REQUEST_FAILED;
  return {
    code: fallbackCode,
    message: ERROR_MESSAGES_RU[fallbackCode] || ERROR_MESSAGES_RU[ERROR_CODES.REQUEST_FAILED] || "",
    hint: ERROR_HINTS_RU[fallbackCode] || ""
  };
}
