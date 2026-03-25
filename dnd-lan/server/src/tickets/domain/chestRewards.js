const CHEST_LOOT_TABLE = Object.freeze([
  {
    key: "moon_key",
    weight: 16,
    item: {
      name: "Лунный ключ",
      description: "Старинный ключ с холодным отблеском. Может открыть скрытый путь или тайник.",
      rarity: "rare",
      weight: 0,
      visibility: "hidden",
      tags: ["сундук", "ключ", "редкость", "icon:gi_key"]
    }
  },
  {
    key: "embershard",
    weight: 14,
    item: {
      name: "Осколок ember-камня",
      description: "Тёплый кристалл, который ценят алхимики и хранители древних печатей.",
      rarity: "uncommon",
      weight: 0,
      visibility: "hidden",
      tags: ["сундук", "кристалл", "реагент", "icon:gi_rune_stone"]
    }
  },
  {
    key: "map_fragment",
    weight: 14,
    item: {
      name: "Фрагмент карты глубин",
      description: "Кусок старой карты с пометкой о забытом лазе и знаком искателей.",
      rarity: "rare",
      weight: 0,
      visibility: "hidden",
      tags: ["сундук", "карта", "зацепка", "icon:gi_treasure_map"]
    }
  },
  {
    key: "lockpick_roll",
    weight: 13,
    item: {
      name: "Тонкие отмычки мастера",
      description: "Набор из трёх прочных отмычек для сложных замков и древних механизмов.",
      rarity: "uncommon",
      weight: 0,
      visibility: "hidden",
      tags: ["сундук", "инструменты", "отмычки", "icon:gi_lockpicks"]
    }
  },
  {
    key: "fortune_seal",
    weight: 12,
    item: {
      name: "Печать тихой удачи",
      description: "Запечатанный талисман на одно решающее испытание. Внутри шуршат искры везения.",
      rarity: "rare",
      weight: 0,
      visibility: "hidden",
      tags: ["сундук", "талисман", "удача", "icon:gi_ring"]
    }
  },
  {
    key: "whisper_scroll",
    weight: 12,
    item: {
      name: "Свиток шёпота",
      description: "Короткий свиток с намёком на скрытую слабость врага или тайный ход сцены.",
      rarity: "uncommon",
      weight: 0,
      visibility: "hidden",
      tags: ["сундук", "свиток", "подсказка", "icon:gi_scroll_unfurled"]
    }
  },
  {
    key: "royal_token",
    weight: 10,
    item: {
      name: "Королевский жетон прохода",
      description: "Редкий жетон, который может стать пропуском, доказательством или долговой распиской.",
      rarity: "very_rare",
      weight: 0,
      visibility: "hidden",
      tags: ["сундук", "жетон", "доступ", "icon:gi_crown"]
    }
  },
  {
    key: "vault_gem",
    weight: 9,
    item: {
      name: "Грань запертого хранилища",
      description: "Неровный самоцвет с меткой древнего сейфа. Ценный след для мастера и группы.",
      rarity: "very_rare",
      weight: 0,
      visibility: "hidden",
      tags: ["сундук", "самоцвет", "артефакт", "icon:gi_gems"]
    }
  }
]);

function cloneReward(def) {
  return {
    ...def,
    item: {
      ...(def?.item || {}),
      tags: Array.isArray(def?.item?.tags) ? [...def.item.tags] : []
    }
  };
}

export function pickChestReward(random = Math.random) {
  const total = CHEST_LOOT_TABLE.reduce((sum, row) => sum + Math.max(1, Number(row.weight || 0)), 0);
  let cursor = random() * total;
  for (const row of CHEST_LOOT_TABLE) {
    cursor -= Math.max(1, Number(row.weight || 0));
    if (cursor <= 0) return cloneReward(row);
  }
  return cloneReward(CHEST_LOOT_TABLE[CHEST_LOOT_TABLE.length - 1]);
}

export function getChestRewardPool() {
  return CHEST_LOOT_TABLE.map(cloneReward);
}
