const MODE_LABELS_RU = {
  normal: "Обычный",
  fast: "Быстрый",
  warmup: "Разминка",
  classic: "Классика",
  master: "Мастер",
  compact: "Компакт",
  chaos: "Хаос",
  risk: "Риск",
  single: "Один шанс"
};

const PERFORMANCE_LABELS_RU = {
  normal: "Обычное",
  clean: "Чистая победа",
  sweep: "Сухая победа",
  combo4: "Комбо x4",
  combo5: "Комбо x5",
  first: "С первой попытки",
  second: "Со второй попытки",
  third: "С третьей попытки",
  long: "Длинное слово",
  rare: "Редкие буквы",
  smart: "Сильная комбинация",
  elite: "Элитная комбинация"
};

const GAME_COPY_RU = {
  ttt: {
    title: "Крестики-нолики: Дуэль разума",
    blurb: "Играй с ИИ и побеждай сериями.",
    rules: [
      "Матч до 2 побед в раундах",
      "Ничья не даёт очков и раунд переигрывается",
      "Победа 2-0 даёт повышенный множитель"
    ]
  },
  guess: {
    title: "Угадай карту: Логика и память",
    blurb: "Подсказки помогают, но время ограничено.",
    rules: [
      "Подсказки открываются по номеру попытки",
      "Чем раньше угадал, тем выше бонус",
      "Раунд ограничен таймером"
    ]
  },
  match3: {
    title: "Три в ряд: Цепочки комбо",
    blurb: "Длинные комбо-цепочки увеличивают награду.",
    rules: [
      "В каждом раунде ограничено число ходов",
      "Комбо x4 даёт дополнительный бонус",
      "Комбо x5 даёт максимальный множитель"
    ]
  },
  dice: {
    title: "Кости и решение: Риск броска",
    blurb: "Перебрось кости и дожми лучшую комбинацию.",
    rules: [
      "Ты видишь 5 костей и можешь сделать до 1 реролла",
      "Сильные комбинации дают повышенный бонус",
      "Режим риска требует более дорогой комбинации"
    ]
  },
  scrabble: {
    title: "Эрудит-блиц: Слово за минуту",
    blurb: "Собери слово из случайного набора букв.",
    rules: [
      "На отправку слова даётся 60 секунд",
      "Длинные слова дают бонус",
      "Редкие буквы усиливают награду"
    ]
  }
};

function isLikelyEnglish(text) {
  const value = String(text || "");
  return /[A-Za-z]/.test(value) && !/[А-Яа-яЁё]/.test(value);
}

export function localizeTagValue(value, field) {
  const raw = String(value || "").trim();
  if (!raw) return raw;
  if (!isLikelyEnglish(raw)) return raw;
  const low = raw.toLowerCase();
  if (field === "difficulty") {
    if (low.includes("easy") || low.includes("low")) return "ЛЕГКО";
    if (low.includes("hard") || low.includes("high")) return "СЛОЖНО";
    if (low.includes("medium") || low.includes("mid")) return "СРЕДНЕ";
  }
  if (field === "risk") {
    if (low.includes("low")) return "Низкий";
    if (low.includes("high")) return "Высокий";
    if (low.includes("medium") || low.includes("mid")) return "Средний";
  }
  if (field === "time") {
    return raw
      .replace(/\bminutes?\b/gi, "мин")
      .replace(/\bmins?\b/gi, "мин")
      .replace(/\bmin\b/gi, "мин")
      .replace(/\s+/g, " ")
      .trim();
  }
  return raw;
}

export function localizeModeLabel(modeKey, modeLabel) {
  const key = String(modeKey || "").toLowerCase();
  const label = String(modeLabel || "").trim();
  if (MODE_LABELS_RU[key]) return MODE_LABELS_RU[key];
  if (!isLikelyEnglish(label)) return label;
  const byLabel = MODE_LABELS_RU[label.toLowerCase()];
  return byLabel || label;
}

export function localizePerformanceLabel(label, key) {
  const raw = String(label || "").trim();
  const lookup = PERFORMANCE_LABELS_RU[String(key || "").toLowerCase()];
  if (lookup) return lookup;
  if (!isLikelyEnglish(raw)) return raw;
  return raw;
}

export function localizeOutcome(outcome) {
  const key = String(outcome || "").toLowerCase();
  if (key === "win") return "победа";
  if (key === "loss") return "поражение";
  if (key === "draw") return "ничья";
  return outcome || "—";
}

export function localizeGameCard(game) {
  const fallback = game || {};
  const ru = GAME_COPY_RU[fallback.key] || {};
  const rules = Array.isArray(fallback.rules) ? fallback.rules : [];
  return {
    ...fallback,
    title: isLikelyEnglish(fallback.title) && ru.title ? ru.title : fallback.title,
    blurb: isLikelyEnglish(fallback.blurb) && ru.blurb ? ru.blurb : fallback.blurb,
    rules: rules.map((rule, idx) => {
      const replacement = Array.isArray(ru.rules) ? ru.rules[idx] : "";
      return isLikelyEnglish(rule) && replacement ? replacement : rule;
    }),
    difficulty: localizeTagValue(fallback.difficulty, "difficulty"),
    risk: localizeTagValue(fallback.risk, "risk"),
    time: localizeTagValue(fallback.time, "time"),
    modes: (Array.isArray(fallback.modes) ? fallback.modes : []).map((mode) => ({
      ...mode,
      label: localizeModeLabel(mode?.key, mode?.label)
    }))
  };
}

export function localizeDailyQuest(quest) {
  if (!quest) return null;
  const next = { ...quest };
  const goal = Number(next.goal || 0) || 2;
  const title = String(next.title || "");
  const description = String(next.description || "");
  if (isLikelyEnglish(title) && String(next.key || "") === "daily_mix") {
    next.title = "Игровой микс";
  }
  if (isLikelyEnglish(description) && String(next.key || "") === "daily_mix") {
    const m = description.match(/play\s+(\d+)\s+different\s+games\s+today/i);
    const n = m ? Number(m[1]) || goal : goal;
    next.description = `Сыграй сегодня в ${n} разные игры`;
  }
  return next;
}
