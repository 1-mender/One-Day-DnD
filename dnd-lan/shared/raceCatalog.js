export const DEFAULT_RACE = "human";

export const RACE_CATALOG = [
  {
    key: "human",
    label: "Человек",
    carryBonus: 0,
    description: "Гибкая и быстро приспосабливающаяся раса.",
    variants: [
      {
        key: "city",
        label: "Городской человек",
        trait: "Связи",
        description: "Лучше ориентируется в законах, рынках и слухах больших городов.",
        tags: ["социум", "торговля"]
      },
      {
        key: "frontier",
        label: "Пограничник",
        trait: "Выживание",
        description: "Привык к дорогам, заставам и жизни на краю цивилизации.",
        tags: ["дороги", "выживание"]
      },
      {
        key: "noble",
        label: "Благородная кровь",
        trait: "Статус",
        description: "Имя семьи открывает двери, но создаёт ожидания и долги.",
        tags: ["статус", "интриги"]
      }
    ]
  },
  {
    key: "elf",
    label: "Эльф",
    carryBonus: 0,
    description: "Долгоживущий народ с тонким восприятием мира и магии.",
    variants: [
      {
        key: "city",
        label: "Городской эльф",
        trait: "Дипломатия улиц",
        description: "Живёт среди других народов, понимает моду, политику и городские маски.",
        tags: ["город", "дипломатия"]
      },
      {
        key: "high",
        label: "Высший эльф",
        trait: "Наследие аркан",
        description: "Происходит из магических домов, где знание считается властью.",
        tags: ["магия", "традиция"]
      },
      {
        key: "wood",
        label: "Лесной эльф",
        trait: "Шёпот троп",
        description: "Читает лес как книгу и редко теряется вдали от дорог.",
        tags: ["лес", "следопыт"]
      },
      {
        key: "dusk",
        label: "Сумеречный эльф",
        trait: "Тень рода",
        description: "Связан с закрытыми общинами, тайнами и осторожным доверием.",
        tags: ["тайны", "скрытность"]
      }
    ]
  },
  {
    key: "half_elf",
    label: "Полуэльф",
    carryBonus: 0,
    description: "Персонаж между мирами, часто свободный от жёстких традиций.",
    variants: [
      {
        key: "court",
        label: "Придворный полуэльф",
        trait: "Две культуры",
        description: "Умеет говорить с разными кругами и сглаживать острые углы.",
        tags: ["двор", "переговоры"]
      },
      {
        key: "wanderer",
        label: "Странник",
        trait: "Без корней",
        description: "Меняет города и компании, быстро находит временное место в группе.",
        tags: ["дороги", "свобода"]
      },
      {
        key: "border",
        label: "Пограничная кровь",
        trait: "Свой среди чужих",
        description: "Привык доказывать право быть частью любой общины.",
        tags: ["социум", "выживание"]
      }
    ]
  },
  {
    key: "dwarf",
    label: "Дворф",
    carryBonus: 5,
    description: "Крепкий народ кланов, ремёсел и долговой памяти.",
    variants: [
      {
        key: "mountain",
        label: "Горный дворф",
        trait: "Каменная стойкость",
        description: "Выдерживает тяжёлые переходы, холод и давление подземелий.",
        tags: ["стойкость", "горы"]
      },
      {
        key: "clan",
        label: "Клановый мастер",
        trait: "Ремесленная честь",
        description: "Знает цену качественной работе и репутации рода.",
        tags: ["ремесло", "клан"]
      },
      {
        key: "exile",
        label: "Изгнанник",
        trait: "Долг без дома",
        description: "Покинул клан, но сохранил упрямство и память о старых клятвах.",
        tags: ["изгнание", "долг"]
      }
    ]
  },
  {
    key: "halfling",
    label: "Полурослик",
    carryBonus: -5,
    description: "Небольшой народ удачи, дома и внезапной храбрости.",
    variants: [
      {
        key: "hearth",
        label: "Домашний полурослик",
        trait: "Тёплый очаг",
        description: "Легко располагает к себе и замечает бытовые детали.",
        tags: ["уют", "удача"]
      },
      {
        key: "river",
        label: "Речной полурослик",
        trait: "Течение дорог",
        description: "Знает переправы, лодки, рынки и слухи на воде.",
        tags: ["река", "торговля"]
      },
      {
        key: "street",
        label: "Уличный полурослик",
        trait: "Незаметный шаг",
        description: "Хорошо проходит там, где крупные привлекают слишком много внимания.",
        tags: ["город", "скрытность"]
      }
    ]
  },
  {
    key: "gnome",
    label: "Гном",
    carryBonus: -5,
    description: "Любознательный народ механизмов, архивов и странной магии.",
    variants: [
      {
        key: "tinker",
        label: "Гном-изобретатель",
        trait: "Малый механизм",
        description: "Понимает устройства, ловушки и странные артефакты.",
        tags: ["механизмы", "артефакты"]
      },
      {
        key: "forest",
        label: "Лесной гном",
        trait: "Малые духи",
        description: "Лучше чувствует зверей, грибы, тропы и тихую магию чащи.",
        tags: ["лес", "духи"]
      },
      {
        key: "archive",
        label: "Архивный гном",
        trait: "Память полок",
        description: "Находит связи между записями, легендами и забытыми деталями.",
        tags: ["знания", "архивы"]
      }
    ]
  },
  {
    key: "orc",
    label: "Орк",
    carryBonus: 5,
    description: "Сильный народ прямого действия, племенной памяти и вызова.",
    variants: [
      {
        key: "clan",
        label: "Клановый орк",
        trait: "Голос племени",
        description: "Ценит силу, слово и место в цепи родства.",
        tags: ["клан", "сила"]
      },
      {
        key: "city",
        label: "Городской орк",
        trait: "Жёсткая репутация",
        description: "Знает, как выживать среди предрассудков и уличных правил.",
        tags: ["город", "репутация"]
      },
      {
        key: "warborn",
        label: "Рождённый войной",
        trait: "Боевой инстинкт",
        description: "С детства видел конфликт и быстро оценивает угрозу.",
        tags: ["бой", "угроза"]
      }
    ]
  },
  {
    key: "half_orc",
    label: "Полуорк",
    carryBonus: 5,
    description: "Персонаж на границе культур, часто привыкший к недоверию.",
    variants: [
      {
        key: "mercenary",
        label: "Наёмная кровь",
        trait: "Цена риска",
        description: "Привык считать опасность работой, а доверие - редкой валютой.",
        tags: ["наёмник", "бой"]
      },
      {
        key: "border",
        label: "Пограничный полуорк",
        trait: "Выдержка чужака",
        description: "Умеет жить между общинами и не ждать лёгкого принятия.",
        tags: ["граница", "выживание"]
      },
      {
        key: "redeemed",
        label: "Искупающий",
        trait: "Сломанный ярлык",
        description: "Доказывает, что происхождение не обязано диктовать судьбу.",
        tags: ["искупление", "воля"]
      }
    ]
  },
  {
    key: "dragonborn",
    label: "Драконорожденный",
    carryBonus: 5,
    description: "Наследник драконьей крови, рода и стихийного достоинства.",
    variants: [
      {
        key: "fire",
        label: "Огненная кровь",
        trait: "Жар рода",
        description: "Темперамент, напор и связь с пламенем видны даже без магии.",
        tags: ["огонь", "род"]
      },
      {
        key: "storm",
        label: "Грозовая кровь",
        trait: "Голос бури",
        description: "Несёт в себе резкость неба, грома и внезапного решения.",
        tags: ["буря", "давление"]
      },
      {
        key: "ancient",
        label: "Древний род",
        trait: "Память чешуи",
        description: "Происходит из линии, где история рода важнее личного желания.",
        tags: ["традиция", "честь"]
      }
    ]
  },
  {
    key: "tiefling",
    label: "Тифлинг",
    carryBonus: 0,
    description: "Народ заметного наследия, тайн и непростого отношения мира.",
    variants: [
      {
        key: "infernal",
        label: "Инфернальное наследие",
        trait: "Печать крови",
        description: "Происхождение заметно в облике, голосе или магическом следе.",
        tags: ["магия", "наследие"]
      },
      {
        key: "urban",
        label: "Городской тифлинг",
        trait: "Привычка к взглядам",
        description: "Научился жить под чужими оценками и обращать их в инструмент.",
        tags: ["город", "социум"]
      },
      {
        key: "occult",
        label: "Оккультный след",
        trait: "Запретные знаки",
        description: "Вокруг персонажа легко возникают слухи о культах и старых договорах.",
        tags: ["тайны", "ритуалы"]
      }
    ]
  },
  {
    key: "goliath",
    label: "Голиаф",
    carryBonus: 10,
    description: "Могучий народ вершин, испытаний и личной доблести.",
    variants: [
      {
        key: "mountain",
        label: "Горный голиаф",
        trait: "Высота не пугает",
        description: "Привык к холоду, скалам и проверке тела на прочность.",
        tags: ["горы", "стойкость"]
      },
      {
        key: "arena",
        label: "Аренный голиаф",
        trait: "Публика помнит",
        description: "Знает цену зрелища, силы и громкой победы.",
        tags: ["арена", "слава"]
      },
      {
        key: "nomad",
        label: "Кочевой голиаф",
        trait: "Путь племени",
        description: "Судит людей по поступкам в дороге, а не по словам у костра.",
        tags: ["дорога", "племя"]
      }
    ]
  }
];

export const RACE_OPTIONS = RACE_CATALOG.map((race) => ({
  value: race.key,
  label: race.label
}));

export const RACE_ALIASES = {
  human: "human",
  "человек": "human",
  elf: "elf",
  "эльф": "elf",
  half_elf: "half_elf",
  "полуэльф": "half_elf",
  "полу_эльф": "half_elf",
  dwarf: "dwarf",
  "дварф": "dwarf",
  "дворф": "dwarf",
  halfling: "halfling",
  "полурослик": "halfling",
  "хоббит": "halfling",
  gnome: "gnome",
  "гном": "gnome",
  orc: "orc",
  "орк": "orc",
  half_orc: "half_orc",
  "полуорк": "half_orc",
  "полу_орк": "half_orc",
  dragonborn: "dragonborn",
  "драконорожденный": "dragonborn",
  "драконорождённый": "dragonborn",
  tiefling: "tiefling",
  "тифлинг": "tiefling",
  goliath: "goliath",
  "голиаф": "goliath"
};

export function normalizeRace(raw) {
  const key = String(raw || "").trim().toLowerCase().replace(/[\s.-]+/g, "_");
  if (!key) return DEFAULT_RACE;
  return RACE_ALIASES[key] || key;
}

export function getRaceByKey(rawRace) {
  const key = normalizeRace(rawRace);
  return RACE_CATALOG.find((race) => race.key === key) || RACE_CATALOG.find((race) => race.key === DEFAULT_RACE);
}

export function getRaceLabel(rawRace) {
  return getRaceByKey(rawRace)?.label || "Человек";
}

export function getRaceVariantOptions(rawRace) {
  return getRaceByKey(rawRace)?.variants || [];
}

export function normalizeRaceVariant(rawVariant, rawRace = DEFAULT_RACE) {
  const variants = getRaceVariantOptions(rawRace);
  const key = String(rawVariant || "").trim().toLowerCase().replace(/[\s.-]+/g, "_");
  if (key && variants.some((variant) => variant.key === key)) return key;
  return variants[0]?.key || "";
}

export function getRaceVariant(rawRace, rawVariant) {
  const variants = getRaceVariantOptions(rawRace);
  const key = normalizeRaceVariant(rawVariant, rawRace);
  return variants.find((variant) => variant.key === key) || variants[0] || null;
}

export function getRaceBonus(rawRace, rawVariant = "") {
  const race = getRaceByKey(rawRace);
  const variant = getRaceVariant(rawRace, rawVariant);
  return Number(race?.carryBonus || 0) + Number(variant?.carryBonus || 0);
}

export function getRaceValue(stats) {
  return getRaceByKey(stats?.race)?.key || DEFAULT_RACE;
}

export function getRaceVariantValue(stats) {
  return normalizeRaceVariant(stats?.raceVariant, getRaceValue(stats));
}

export function getRaceProfile(statsOrRace, maybeVariant = "") {
  const source = statsOrRace && typeof statsOrRace === "object" && !Array.isArray(statsOrRace)
    ? statsOrRace
    : { race: statsOrRace, raceVariant: maybeVariant };
  const race = getRaceByKey(source?.race);
  const variant = getRaceVariant(race?.key, source?.raceVariant);
  const bonus = getRaceBonus(race?.key, variant?.key);
  return {
    key: race?.key || DEFAULT_RACE,
    raceKey: race?.key || DEFAULT_RACE,
    label: race?.label || "Человек",
    raceLabel: race?.label || "Человек",
    description: race?.description || "",
    variantKey: variant?.key || "",
    variantLabel: variant?.label || "",
    variantDescription: variant?.description || "",
    displayName: variant?.label || race?.label || "Человек",
    combinedLabel: variant?.label ? `${race?.label || "Человек"} · ${variant.label}` : race?.label || "Человек",
    trait: variant?.trait || "",
    tags: Array.isArray(variant?.tags) ? variant.tags : [],
    carryBonus: bonus
  };
}

export function getRaceDisplayLabel(statsOrRace, maybeVariant = "") {
  const profile = getRaceProfile(statsOrRace, maybeVariant);
  return profile.displayName || profile.label;
}

export function setRaceInStats(stats, race) {
  const next = { ...(stats || {}) };
  const normalizedRace = getRaceByKey(race)?.key || DEFAULT_RACE;
  next.race = normalizedRace;
  next.raceVariant = normalizeRaceVariant(next.raceVariant, normalizedRace);
  return next;
}

export function setRaceVariantInStats(stats, variant) {
  const next = { ...(stats || {}) };
  const race = getRaceByKey(next.race)?.key || DEFAULT_RACE;
  next.race = race;
  next.raceVariant = normalizeRaceVariant(variant, race);
  return next;
}
