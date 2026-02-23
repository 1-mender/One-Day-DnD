const BASE_SHOP_CATALOG = [
  {
    key: "boosts",
    title: "Ядро усилений",
    subtitle: "Редкие эффекты с большим влиянием и строгими лимитами",
    items: [
      {
        key: "stat",
        title: "+1 к характеристике",
        blurb: "Выбери СИЛ/ЛОВ/ТЕЛ/ИНТ/МДР/ХАР. Улучшение сохраняется в профиле.",
        price: 12,
        impact: "Сила",
        impactClass: "impact-high",
        limit: "1 на персонажа",
        note: "Подтверждает мастер"
      },
      {
        key: "feat",
        title: "Талант по сюжету",
        blurb: "Тематический перк средней силы, окончательно утверждает мастер.",
        price: 15,
        impact: "Сила",
        impactClass: "impact-high",
        limit: "1 за сессию",
        note: "Сюжет важнее цифр"
      }
    ]
  },
  {
    key: "consumables",
    title: "Расходники",
    subtitle: "Тактические инструменты для критических моментов",
    items: [
      {
        key: "reroll",
        title: "Один реролл",
        blurb: "Замени результат одного броска новым броском.",
        price: 4,
        impact: "Тактика",
        impactClass: "impact-mid",
        limit: "2 за сессию",
        note: "Можно после броска"
      },
      {
        key: "luck",
        title: "Печать удачи",
        blurb: "+1 к одному броску в эпизоде, действует до конца сцены.",
        price: 3,
        impact: "Тактика",
        impactClass: "impact-mid",
        limit: "3 за сессию",
        note: "Сочетается с вдохновением"
      }
    ]
  },
  {
    key: "mystery",
    title: "Тайная полка",
    subtitle: "Рискованные покупки для неожиданных сюжетных поворотов",
    items: [
      {
        key: "chest",
        title: "Сундук-сюрприз",
        blurb: "Случайная награда из пула мастера: артефакт, ключ или зацепка.",
        price: 7,
        impact: "Риск",
        impactClass: "impact-high",
        limit: "1 за сессию",
        note: "Результат зависит от удачи"
      },
      {
        key: "hint",
        title: "Секретная подсказка",
        blurb: "Одна контекстная подсказка для сцены, локации или NPC.",
        price: 5,
        impact: "Риск",
        impactClass: "impact-high",
        limit: "2 за сессию",
        note: "Углубляет лор и развилки"
      }
    ]
  }
];

const FALLBACK_SECTION = {
  key: "other",
  title: "Особые товары",
  subtitle: "Позиции из серверных правил, без локального описания"
};

function toHumanTitle(value) {
  return String(value || "")
    .trim()
    .replace(/[\s_]+/g, " ")
    .replace(/^\w/, (ch) => ch.toUpperCase());
}

function makeFallbackItem(itemKey, rule) {
  return {
    key: itemKey,
    title: toHumanTitle(itemKey) || "Товар",
    blurb: "Описание отсутствует в локальном каталоге.",
    price: Number(rule?.price || 0),
    impact: "Эффект",
    impactClass: "impact-mid",
    limit: "По правилам мастера",
    note: "Уточняйте детали у мастера"
  };
}

export function buildShopCatalog(shopRules) {
  const rules = shopRules && typeof shopRules === "object" ? shopRules : null;
  if (!rules) return BASE_SHOP_CATALOG;
  if (!Object.keys(rules).length) return [];

  const ruleKeys = new Set(Object.keys(rules));
  const knownKeys = new Set();

  const sections = BASE_SHOP_CATALOG
    .map((section) => {
      const items = section.items.filter((item) => {
        knownKeys.add(item.key);
        return ruleKeys.has(item.key);
      });
      return { ...section, items };
    })
    .filter((section) => section.items.length > 0);

  const extraKeys = Object.keys(rules).filter((key) => !knownKeys.has(key));
  if (extraKeys.length) {
    sections.push({
      ...FALLBACK_SECTION,
      items: extraKeys.map((itemKey) => makeFallbackItem(itemKey, rules[itemKey]))
    });
  }

  return sections;
}

export { BASE_SHOP_CATALOG };
