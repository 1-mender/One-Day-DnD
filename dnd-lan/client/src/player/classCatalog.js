export const SPECIALIZATION_XP_THRESHOLD = 100;

export const SPECIALIZATION_ROLE_LABELS = {
  damage: "Урон",
  tank: "Танк",
  support: "Поддержка",
  control: "Контроль",
  utility: "Утилити",
  social: "Социалка",
  risk: "Риск",
  summon: "Призыв"
};

export const CLASS_CATALOG = [
  {
    key: "warrior",
    label: "Воин",
    description: "Фронтовик, который держит удар и решает бой силой оружия.",
    specializations: [
      { key: "berserker", label: "Берсерк", role: "damage", tags: ["ярость", "риск", "ближний бой"], description: "Ярость, жертва защитой ради огромного урона." },
      { key: "defender", label: "Защитник", role: "tank", tags: ["щит", "броня", "агро"], description: "Щит и тяжелая броня, удержание врагов." },
      { key: "mystic_knight", label: "Рыцарь-Мистик", role: "control", tags: ["барьеры", "оружие", "телепорт"], description: "Магия в броне: чары на оружие, барьеры, телепортация." }
    ]
  },
  {
    key: "mage",
    label: "Маг",
    description: "Заклинатель, управляющий стихиями и полем боя.",
    specializations: [
      { key: "pyromancer", label: "Пиромант", role: "damage", tags: ["огонь", "взрывы", "зона"], description: "Огонь, взрывы, устойчивое горение." },
      { key: "cryomancer", label: "Криомант", role: "control", tags: ["лёд", "замедление", "стены"], description: "Заморозка, ледяные стены, замедление." },
      { key: "archmage", label: "Архимаг", role: "support", tags: ["баффы", "дебаффы", "универсал"], description: "Усиление союзников, ослабление врагов, универсализм." }
    ]
  },
  {
    key: "cleric",
    label: "Жрец",
    description: "Проводник веры, света и защитных чудес.",
    specializations: [
      { key: "healer", label: "Клирик", role: "support", tags: ["лечение", "снятие проклятий", "свет"], description: "Чистое лечение, снятие проклятий." },
      { key: "paladin", label: "Паладин", role: "tank", tags: ["броня", "аура", "свет"], description: "Тяжелая броня, световые удары, аура защиты." },
      { key: "inquisitor", label: "Инквизитор", role: "control", tags: ["антимагия", "нежить", "каратель"], description: "Подавление магии, урон по еретикам и нежити." }
    ]
  },
  {
    key: "archer",
    label: "Лучник",
    description: "Дальний боец, который контролирует дистанцию и темп.",
    specializations: [
      { key: "sniper", label: "Снайпер", role: "damage", tags: ["одна цель", "дистанция", "пробитие"], description: "Огромный урон по одной цели, пронзающие стрелы." },
      { key: "ranger", label: "Рейнджер", role: "utility", tags: ["питомец", "ловушки", "выживание"], description: "Питомец, ловушки, выживание в дикой местности." },
      { key: "shadow_archer", label: "Теневой стрелок", role: "control", tags: ["яд", "скрытность", "проклятия"], description: "Скрытность, отравленные стрелы, проклятия." }
    ]
  },
  {
    key: "rogue",
    label: "Вор",
    description: "Ловкость, обман, скрытность и точные удары.",
    specializations: [
      { key: "assassin", label: "Ассасин", role: "damage", tags: ["тень", "яды", "рывок"], description: "Мгновенные убийства из тени, яды, невидимость." },
      { key: "bandit", label: "Разбойник", role: "utility", tags: ["два клинка", "кража", "трюки"], description: "Два клинка, подножки, кража предметов." },
      { key: "spy", label: "Шпион", role: "social", tags: ["маскировка", "интриги", "саботаж"], description: "Маскировка, социальные интриги, саботаж." }
    ]
  },
  {
    key: "druid",
    label: "Друид",
    description: "Сила природы, звериные формы и живые заклинания.",
    specializations: [
      { key: "grove_keeper", label: "Хранитель рощи", role: "support", tags: ["растения", "защита", "лечение"], description: "Лечение и защита растениями, живая изгородь." },
      { key: "wild_beast", label: "Дикий зверь", role: "tank", tags: ["форма зверя", "медведь", "волк"], description: "Обращение в медведя для танка или волка для урона." },
      { key: "storm_lord", label: "Повелитель бурь", role: "control", tags: ["молнии", "ураган", "кислота"], description: "Молнии, ураганы, кислотные дожди." }
    ]
  },
  {
    key: "necromancer",
    label: "Некромант",
    description: "Темная магия смерти, миньоны и кража жизненной силы.",
    specializations: [
      { key: "bone_bearer", label: "Костеносец", role: "summon", tags: ["скелеты", "зомби", "миньоны"], description: "Армия скелетов и зомби, взрывные миньоны." },
      { key: "vampire", label: "Вампир", role: "damage", tags: ["кража жизни", "туман", "смерть"], description: "Высасывание жизни, туман, усиление от смерти врагов." },
      { key: "lich", label: "Лич-некромант", role: "risk", tags: ["мана", "возрождение", "нежить"], description: "Отказ от плоти, огромная мана, возрождение раз в бой." }
    ]
  },
  {
    key: "sorcerer",
    label: "Чародей",
    description: "Нестабильная врожденная магия и рискованные эффекты.",
    specializations: [
      { key: "wild_mage", label: "Дикий маг", role: "risk", tags: ["случайность", "всплески", "хаос"], description: "Случайные эффекты: взрыв, превращение в курицу и другие всплески." },
      { key: "blood_sorcerer", label: "Кровавый чародей", role: "risk", tags: ["здоровье", "усиление", "низкий HP"], description: "Трата здоровья вместо маны, усиление при низком HP." },
      { key: "chaosist", label: "Хаосит", role: "control", tags: ["реальность", "копии", "обмен местами"], description: "Искажение реальности, обмен местами, копии, хаотичные баффы." }
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

export function getSpecializationRole(profile) {
  const specialization = getSpecializationByKey(profile?.classKey, profile?.specializationKey);
  if (!specialization?.role) return null;
  return {
    key: specialization.role,
    label: SPECIALIZATION_ROLE_LABELS[specialization.role] || specialization.role
  };
}

export function getSpecializationTags(profile) {
  const specialization = getSpecializationByKey(profile?.classKey, profile?.specializationKey);
  return Array.isArray(specialization?.tags) ? specialization.tags : [];
}

export function getClassPathLabelWithRole(profile) {
  const label = getClassPathLabel(profile);
  const role = getSpecializationRole(profile);
  return [label, role?.label].filter(Boolean).join(" · ");
}

export function canChooseSpecialization(profile) {
  return Number(profile?.xp || 0) >= SPECIALIZATION_XP_THRESHOLD;
}
