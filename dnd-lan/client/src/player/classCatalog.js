export const SPECIALIZATION_XP_THRESHOLD = 100;

export const CLASS_CATALOG = [
  {
    key: "warrior",
    label: "Воин",
    description: "Фронтовик, который держит удар и решает бой силой оружия.",
    specializations: [
      { key: "berserker", label: "Берсерк", description: "Ярость, жертва защитой ради огромного урона." },
      { key: "defender", label: "Защитник", description: "Щит и тяжелая броня, удержание врагов." },
      { key: "mystic_knight", label: "Рыцарь-Мистик", description: "Магия в броне: чары на оружие, барьеры, телепортация." }
    ]
  },
  {
    key: "mage",
    label: "Маг",
    description: "Заклинатель, управляющий стихиями и полем боя.",
    specializations: [
      { key: "pyromancer", label: "Пиромант", description: "Огонь, взрывы, устойчивое горение." },
      { key: "cryomancer", label: "Криомант", description: "Заморозка, ледяные стены, замедление." },
      { key: "archmage", label: "Архимаг", description: "Усиление союзников, ослабление врагов, универсализм." }
    ]
  },
  {
    key: "cleric",
    label: "Жрец",
    description: "Проводник веры, света и защитных чудес.",
    specializations: [
      { key: "healer", label: "Клирик", description: "Чистое лечение, снятие проклятий." },
      { key: "paladin", label: "Паладин", description: "Тяжелая броня, световые удары, аура защиты." },
      { key: "inquisitor", label: "Инквизитор", description: "Подавление магии, урон по еретикам и нежити." }
    ]
  },
  {
    key: "archer",
    label: "Лучник",
    description: "Дальний боец, который контролирует дистанцию и темп.",
    specializations: [
      { key: "sniper", label: "Снайпер", description: "Огромный урон по одной цели, пронзающие стрелы." },
      { key: "ranger", label: "Рейнджер", description: "Питомец, ловушки, выживание в дикой местности." },
      { key: "shadow_archer", label: "Теневой стрелок", description: "Скрытность, отравленные стрелы, проклятия." }
    ]
  },
  {
    key: "rogue",
    label: "Вор",
    description: "Ловкость, обман, скрытность и точные удары.",
    specializations: [
      { key: "assassin", label: "Ассасин", description: "Мгновенные убийства из тени, яды, невидимость." },
      { key: "bandit", label: "Разбойник", description: "Два клинка, подножки, кража предметов." },
      { key: "spy", label: "Шпион", description: "Маскировка, социальные интриги, саботаж." }
    ]
  },
  {
    key: "druid",
    label: "Друид",
    description: "Сила природы, звериные формы и живые заклинания.",
    specializations: [
      { key: "grove_keeper", label: "Хранитель рощи", description: "Лечение и защита растениями, живая изгородь." },
      { key: "wild_beast", label: "Дикий зверь", description: "Обращение в медведя для танка или волка для урона." },
      { key: "storm_lord", label: "Повелитель бурь", description: "Молнии, ураганы, кислотные дожди." }
    ]
  },
  {
    key: "necromancer",
    label: "Некромант",
    description: "Темная магия смерти, миньоны и кража жизненной силы.",
    specializations: [
      { key: "bone_bearer", label: "Костеносец", description: "Армия скелетов и зомби, взрывные миньоны." },
      { key: "vampire", label: "Вампир", description: "Высасывание жизни, туман, усиление от смерти врагов." },
      { key: "lich", label: "Лич-некромант", description: "Отказ от плоти, огромная мана, возрождение раз в бой." }
    ]
  },
  {
    key: "sorcerer",
    label: "Чародей",
    description: "Нестабильная врожденная магия и рискованные эффекты.",
    specializations: [
      { key: "wild_mage", label: "Дикий маг", description: "Случайные эффекты: взрыв, превращение в курицу и другие всплески." },
      { key: "blood_sorcerer", label: "Кровавый чародей", description: "Трата здоровья вместо маны, усиление при низком HP." },
      { key: "chaosist", label: "Хаосит", description: "Искажение реальности, обмен местами, копии, хаотичные баффы." }
    ]
  }
];

export function getClassByKey(classKey) {
  return CLASS_CATALOG.find((item) => item.key === String(classKey || "")) || null;
}

export function getSpecializationByKey(classKey, specializationKey) {
  const baseClass = getClassByKey(classKey);
  if (!baseClass) return null;
  return baseClass.specializations.find((item) => item.key === String(specializationKey || "")) || null;
}

export function getClassPathLabel(profile) {
  const baseClass = getClassByKey(profile?.classKey);
  const specialization = getSpecializationByKey(profile?.classKey, profile?.specializationKey);
  if (baseClass && specialization) return `${baseClass.label} · ${specialization.label}`;
  if (baseClass) return baseClass.label;
  return String(profile?.classRole || "").trim();
}

export function getClassPathDescription(profile) {
  const specialization = getSpecializationByKey(profile?.classKey, profile?.specializationKey);
  if (specialization) return specialization.description;
  const baseClass = getClassByKey(profile?.classKey);
  return baseClass?.description || "";
}

export function canChooseSpecialization(profile) {
  return Number(profile?.xp || 0) >= SPECIALIZATION_XP_THRESHOLD;
}
