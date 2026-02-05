export const GAME_CATALOG = [
  {
    key: "ttt",
    title: "Крестики-нолики: дуэль умов",
    blurb: "Best of 3 против ИИ. Победа 2-0 дает бонус.",
    difficulty: "Легкая",
    time: "2-4 мин",
    risk: "Низкий",
    rules: [
      "Матч до 2 побед",
      "Ничья = переигровка раунда",
      "Победа 2-0: повышенный множитель"
    ],
    modes: [
      { key: "normal", label: "Обычный", roundsToWin: 2, ai: "standard" },
      { key: "fast", label: "Быстрый", roundsToWin: 1, ai: "standard" }
    ]
  },
  {
    key: "guess",
    title: "Угадай карту: разум и память",
    blurb: "Подсказки дают ориентир, но решает скорость.",
    difficulty: "Средняя",
    time: "3-5 мин",
    risk: "Средний",
    rules: [
      "Подсказки открываются по попыткам",
      "Чем раньше угадаешь, тем выше бонус",
      "Время ограничено таймером"
    ],
    modes: [
      { key: "easy", label: "Разминка", ranks: ["A", "K", "Q"], maxAttempts: 4, timeLimit: 50, hintCount: 3 },
      { key: "normal", label: "Классика", ranks: ["A", "K", "Q", "J"], maxAttempts: 3, timeLimit: 40, hintCount: 3 },
      { key: "hard", label: "Мастер", ranks: ["A", "K", "Q", "J", "10"], maxAttempts: 3, timeLimit: 32, hintCount: 2 }
    ]
  },
  {
    key: "match3",
    title: "Три в ряд: цепные комбо",
    blurb: "Цепочки комбо разгоняют награду.",
    difficulty: "Средняя",
    time: "4-6 мин",
    risk: "Средний",
    rules: [
      "Ограничение по ходам",
      "Комбо 4+ дают бонус",
      "Комбо 5+ усиливают финал"
    ],
    modes: [
      { key: "normal", label: "Классика", size: 6, moves: 18, target: 120, colors: 6, blocks: 0 },
      { key: "compact", label: "Сжатый", size: 5, moves: 14, target: 90, colors: 5, blocks: 0 },
      { key: "chaos", label: "Хаос", size: 7, moves: 20, target: 180, colors: 7, blocks: 6 }
    ]
  },
  {
    key: "uno",
    title: "Uno-мини: быстрый матч",
    blurb: "Сбрось карты быстрее соперника.",
    difficulty: "Средняя",
    time: "5-7 мин",
    risk: "Средний",
    rules: [
      "Игра до нуля карт",
      "Штрафы за добор повышают риск",
      "Чистая победа дает бонус"
    ],
    modes: [
      { key: "normal", label: "Классика", handSize: 5, ai: "standard" }
    ]
  },
  {
    key: "scrabble",
    title: "Эрудит-блиц: слово за минуту",
    blurb: "Собери слово из набора букв.",
    difficulty: "Сложная",
    time: "2-3 мин",
    risk: "Высокий",
    rules: [
      "60 секунд на слово",
      "Длинное слово дает бонус",
      "Редкая буква усиливает награду"
    ],
    modes: [
      { key: "normal", label: "Классика", timeLimit: 60, rackSize: 7 }
    ]
  }
];

export function validateGameCatalog(list = GAME_CATALOG) {
  if (!Array.isArray(list) || list.length === 0) throw new Error("Game catalog is empty.");
  const seen = new Set();
  for (const game of list) {
    if (!game?.key || !game?.title) throw new Error("Game catalog entry missing key/title.");
    if (seen.has(game.key)) throw new Error(`Duplicate game key: ${game.key}`);
    seen.add(game.key);
    if (!Array.isArray(game.rules)) throw new Error(`Game ${game.key} is missing rules.`);
    if (!Array.isArray(game.modes) || game.modes.length === 0) {
      throw new Error(`Game ${game.key} is missing modes.`);
    }
  }
}
