import {
  GiAxeSwing,
  GiBowieKnife,
  GiBowArrow,
  GiBroadsword,
  GiMaceHead,
  GiShield,
  GiSpears,
  GiBackpack,
  GiBookCover,
  GiBookAura,
  GiBookPile,
  GiBookshelf,
  GiBookmark,
  GiChest,
  GiLockedChest,
  GiCrown,
  GiGems,
  GiKey,
  GiKeyring,
  GiLockpicks,
  GiLantern,
  GiLanternFlame,
  GiCompass,
  GiRopeCoil,
  GiTorch,
  GiRing,
  GiScrollUnfurled,
  GiScrollQuill,
  GiQuillInk,
  GiSpellBook,
  GiCrystalBall,
  GiCrystalWand,
  GiOrbWand,
  GiRuneStone,
  GiWizardStaff,
  GiMagicSwirl,
  GiMagicPortal,
  GiMagicHat,
  GiMagicPotion,
  GiMagicShield,
  GiCauldron,
  GiHolyWater,
  GiEyedropper,
  GiBottleVapors,
  GiAnkh,
  GiHolyGrail,
  GiHolySymbol,
  GiRelicBlade,
  GiSkullRing,
  GiPotionBall,
  GiPotionOfMadness,
  GiAppleCore,
  GiBread,
  GiBreadSlice,
  GiCheeseWedge,
  GiHerbsBundle,
  GiHoneyJar,
  GiMeat,
  GiMushroom,
  GiFishSmoking,
  GiBerryBush,
  GiBeerStein,
  GiBeerBottle,
  GiWineBottle,
  GiWineGlass,
  GiTeapot
} from "react-icons/gi";

export const ICON_TAG_PREFIX = "icon:";

export const INVENTORY_ICON_SECTIONS = [
  {
    key: "weapons",
    label: "Оружие",
    items: [
      { key: "gi_broadsword", label: "Меч", Icon: GiBroadsword },
      { key: "gi_bow_arrow", label: "Лук", Icon: GiBowArrow },
      { key: "gi_bowie_knife", label: "Кинжал", Icon: GiBowieKnife },
      { key: "gi_axe_swing", label: "Топор", Icon: GiAxeSwing },
      { key: "gi_mace_head", label: "Булава", Icon: GiMaceHead },
      { key: "gi_spears", label: "Копьё", Icon: GiSpears },
      { key: "gi_shield", label: "Щит", Icon: GiShield }
    ]
  },
  {
    key: "magic",
    label: "Магия",
    items: [
      { key: "gi_magic_swirl", label: "Чары", Icon: GiMagicSwirl },
      { key: "gi_magic_portal", label: "Портал", Icon: GiMagicPortal },
      { key: "gi_magic_hat", label: "Шляпа мага", Icon: GiMagicHat },
      { key: "gi_crystal_ball", label: "Кристальный шар", Icon: GiCrystalBall },
      { key: "gi_crystal_wand", label: "Кристальный жезл", Icon: GiCrystalWand },
      { key: "gi_orb_wand", label: "Жезл-орб", Icon: GiOrbWand },
      { key: "gi_rune_stone", label: "Рунический камень", Icon: GiRuneStone },
      { key: "gi_spell_book", label: "Книга заклинаний", Icon: GiSpellBook },
      { key: "gi_wizard_staff", label: "Посох мага", Icon: GiWizardStaff },
      { key: "gi_magic_shield", label: "Магический щит", Icon: GiMagicShield }
    ]
  },
  {
    key: "alchemy",
    label: "Алхимия",
    items: [
      { key: "gi_cauldron", label: "Котёл", Icon: GiCauldron },
      { key: "gi_magic_potion", label: "Магическое зелье", Icon: GiMagicPotion },
      { key: "gi_potion_ball", label: "Зелье", Icon: GiPotionBall },
      { key: "gi_potion_of_madness", label: "Эликсир", Icon: GiPotionOfMadness },
      { key: "gi_holy_water", label: "Святая вода", Icon: GiHolyWater },
      { key: "gi_eyedropper", label: "Пипетка", Icon: GiEyedropper },
      { key: "gi_bottle_vapors", label: "Флакон", Icon: GiBottleVapors },
      { key: "gi_herbs_bundle", label: "Травы", Icon: GiHerbsBundle }
    ]
  },
  {
    key: "relics",
    label: "Реликвии",
    items: [
      { key: "gi_ankh", label: "Анх", Icon: GiAnkh },
      { key: "gi_holy_grail", label: "Святой Грааль", Icon: GiHolyGrail },
      { key: "gi_holy_symbol", label: "Священный символ", Icon: GiHolySymbol },
      { key: "gi_relic_blade", label: "Реликтовый клинок", Icon: GiRelicBlade },
      { key: "gi_skull_ring", label: "Кольцо черепа", Icon: GiSkullRing },
      { key: "gi_crown", label: "Корона", Icon: GiCrown }
    ]
  },
  {
    key: "books",
    label: "Книги и свитки",
    items: [
      { key: "gi_book_cover", label: "Книга", Icon: GiBookCover },
      { key: "gi_book_aura", label: "Тайная книга", Icon: GiBookAura },
      { key: "gi_book_pile", label: "Стопка книг", Icon: GiBookPile },
      { key: "gi_bookshelf", label: "Книжная полка", Icon: GiBookshelf },
      { key: "gi_bookmark", label: "Закладка", Icon: GiBookmark },
      { key: "gi_scroll_unfurled", label: "Свиток", Icon: GiScrollUnfurled },
      { key: "gi_scroll_quill", label: "Свиток с пером", Icon: GiScrollQuill },
      { key: "gi_quill_ink", label: "Перо и чернила", Icon: GiQuillInk }
    ]
  },
  {
    key: "gear",
    label: "Снаряжение",
    items: [
      { key: "gi_backpack", label: "Рюкзак", Icon: GiBackpack },
      { key: "gi_key", label: "Ключ", Icon: GiKey },
      { key: "gi_keyring", label: "Связка ключей", Icon: GiKeyring },
      { key: "gi_lockpicks", label: "Отмычки", Icon: GiLockpicks },
      { key: "gi_chest", label: "Сундук", Icon: GiChest },
      { key: "gi_locked_chest", label: "Запертый сундук", Icon: GiLockedChest },
      { key: "gi_lantern", label: "Фонарь", Icon: GiLantern },
      { key: "gi_lantern_flame", label: "Фонарь с огнём", Icon: GiLanternFlame },
      { key: "gi_torch", label: "Факел", Icon: GiTorch },
      { key: "gi_rope_coil", label: "Верёвка", Icon: GiRopeCoil },
      { key: "gi_compass", label: "Компас", Icon: GiCompass },
      { key: "gi_gems", label: "Драгоценности", Icon: GiGems },
      { key: "gi_ring", label: "Кольцо", Icon: GiRing }
    ]
  },
  {
    key: "consumables",
    label: "Расходники",
    items: [
      { key: "gi_bread", label: "Хлеб", Icon: GiBread },
      { key: "gi_bread_slice", label: "Ломоть хлеба", Icon: GiBreadSlice },
      { key: "gi_cheese_wedge", label: "Сыр", Icon: GiCheeseWedge },
      { key: "gi_apple_core", label: "Яблоко", Icon: GiAppleCore },
      { key: "gi_meat", label: "Мясо", Icon: GiMeat },
      { key: "gi_mushroom", label: "Грибы", Icon: GiMushroom },
      { key: "gi_fish_smoking", label: "Копчёная рыба", Icon: GiFishSmoking },
      { key: "gi_honey_jar", label: "Мёд", Icon: GiHoneyJar },
      { key: "gi_berry_bush", label: "Ягоды", Icon: GiBerryBush },
      { key: "gi_beer_stein", label: "Пиво", Icon: GiBeerStein },
      { key: "gi_beer_bottle", label: "Бутылка пива", Icon: GiBeerBottle },
      { key: "gi_wine_bottle", label: "Вино", Icon: GiWineBottle },
      { key: "gi_wine_glass", label: "Бокал вина", Icon: GiWineGlass },
      { key: "gi_teapot", label: "Чайник", Icon: GiTeapot }
    ]
  }
];

export const INVENTORY_ICON_MAP = INVENTORY_ICON_SECTIONS.reduce((acc, section) => {
  for (const item of section.items) acc[item.key] = item.Icon;
  return acc;
}, {});

export function getInventoryIcon(iconKey) {
  if (!iconKey) return null;
  return INVENTORY_ICON_MAP[String(iconKey)] || null;
}

export function getIconKeyFromTags(tags) {
  const list = Array.isArray(tags) ? tags : [];
  const tag = list.find((t) => String(t).toLowerCase().startsWith(ICON_TAG_PREFIX));
  if (!tag) return "";
  return String(tag).slice(ICON_TAG_PREFIX.length);
}

export function getIconKeyFromItem(item) {
  if (!item) return "";
  const direct = item.iconKey || item.icon_key;
  if (direct) return String(direct);
  return getIconKeyFromTags(item.tags);
}

export function stripIconTags(tags) {
  return (Array.isArray(tags) ? tags : []).filter(
    (t) => !String(t).toLowerCase().startsWith(ICON_TAG_PREFIX)
  );
}

export function applyIconTag(tags, iconKey) {
  const cleaned = stripIconTags(tags);
  if (!iconKey) return cleaned;
  return [...cleaned, `${ICON_TAG_PREFIX}${iconKey}`];
}
