export const GAME_CATALOG = [
  {
    key: "ttt",
    title: "Крестики-нолики: Дуэль разума",
    blurb: "Матч до 2 побед против ИИ. Счёт 2:0 даёт бонус.",
    difficulty: "Легко",
    time: "2-4 min",
    risk: "Низкий",
    rules: [
      "Матч до 2 побед в раундах",
      "Ничья переигрывает раунд",
      "Победа 2:0 даёт повышенный множитель"
    ],
    modes: [
      {
        key: "normal",
        label: "Обычный",
        roundsToWin: 2,
        ai: "standard",
        summary: "Матч до двух побед. Лучший вход для бесплатной серии."
      },
      {
        key: "fast",
        label: "Быстрый",
        roundsToWin: 1,
        ai: "standard",
        summary: "Один решающий раунд. Быстрее, но награда скромнее."
      }
    ]
  },
  {
    key: "guess",
    title: "Угадай карту: Логика и память",
    blurb: "Подсказки помогают, но скорость тоже важна.",
    difficulty: "Средне",
    time: "3-5 min",
    risk: "Средний",
    rules: [
      "Подсказки открываются по номеру попытки",
      "Чем раньше угадаешь, тем выше бонус",
      "Время раунда ограничено таймером"
    ],
    modes: [
      {
        key: "easy",
        label: "Разминка",
        ranks: ["A", "K", "Q"],
        maxAttempts: 4,
        timeLimit: 50,
        hintCount: 3,
        summary: "Самый безопасный режим: больше подсказок и бесплатный вход."
      },
      {
        key: "normal",
        label: "Классика",
        ranks: ["A", "K", "Q", "J"],
        maxAttempts: 3,
        timeLimit: 40,
        hintCount: 3,
        summary: "Базовый баланс между риском, временем и наградой."
      },
      {
        key: "hard",
        label: "Мастер",
        ranks: ["A", "K", "Q", "J", "10"],
        maxAttempts: 3,
        timeLimit: 32,
        hintCount: 2,
        summary: "Шире колода, меньше времени и выше награда за точность."
      }
    ]
  },
  {
    key: "match3",
    title: "Три в ряд: Цепочки комбо",
    blurb: "Длинные цепочки комбо увеличивают итоговую награду.",
    difficulty: "Средне",
    time: "4-6 min",
    risk: "Средний",
    rules: [
      "В каждом раунде ограничено число ходов",
      "Комбо 4+ даёт дополнительный бонус",
      "Комбо 5+ даёт максимальный множитель"
    ],
    modes: [
      {
        key: "normal",
        label: "Классика",
        size: 6,
        moves: 18,
        target: 120,
        colors: 6,
        blocks: 0,
        summary: "Стабильное поле и средняя награда за длинные комбо."
      },
      {
        key: "compact",
        label: "Компакт",
        size: 5,
        moves: 14,
        target: 90,
        colors: 5,
        blocks: 0,
        summary: "Меньше поле и бесплатный вход. Подходит для быстрой разминки."
      },
      {
        key: "chaos",
        label: "Хаос",
        size: 7,
        moves: 20,
        target: 180,
        colors: 7,
        blocks: 6,
        summary: "Большое поле с блоками. Дороже вход, но заметно выше награда."
      }
    ]
  },
  {
    key: "dice",
    title: "Кости и решение: Риск броска",
    blurb: "Оцени бросок, реши что перебросить и дожми лучшую комбинацию.",
    difficulty: "Средне",
    time: "2-4 min",
    risk: "Средний",
    rules: [
      "Ты видишь 5 костей и можешь сделать до 1 реролла",
      "Сильные комбинации дают повышенный множитель",
      "В режиме риска нужна более дорогая комбинация"
    ],
    modes: [
      {
        key: "classic",
        label: "Классика",
        allowReroll: true,
        targetScore: 2,
        timeLimit: 40,
        summary: "Один реролл и спокойный порог для хорошей комбинации."
      },
      {
        key: "risk",
        label: "Риск",
        allowReroll: true,
        targetScore: 4,
        timeLimit: 32,
        summary: "Нужна сильная комбинация. Билет дороже, но выигрыш выше."
      },
      {
        key: "single",
        label: "Один шанс",
        allowReroll: false,
        targetScore: 1,
        timeLimit: 24,
        summary: "Без реролла и почти без риска. Хорош для быстрого старта."
      }
    ]
  },
  {
    key: "scrabble",
    title: "Эрудит-блиц: Слово за минуту",
    blurb: "Собери слово из случайного набора букв.",
    difficulty: "Сложно",
    time: "2-3 min",
    risk: "Высокий",
    rules: [
      "У тебя 60 секунд на отправку слова",
      "Длинные слова дают бонус",
      "Редкие буквы повышают награду"
    ],
    modes: [
      {
        key: "normal",
        label: "Классика",
        timeLimit: 60,
        rackSize: 7,
        summary: "Базовый набор букв и мягкий темп на разгон."
      },
      {
        key: "rush",
        label: "Блиц",
        timeLimit: 45,
        rackSize: 6,
        summary: "Меньше букв и жёстче таймер. Быстрый рискованный раунд."
      },
      {
        key: "expert",
        label: "Эксперт",
        timeLimit: 55,
        rackSize: 8,
        summary: "Больше букв и выше потолок награды за длинные слова."
      }
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
