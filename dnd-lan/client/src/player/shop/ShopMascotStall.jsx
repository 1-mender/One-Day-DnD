import React from "react";

const LABEL_SIGN = "Вывеска лавки Джо";
const NAME_SHOPKEEPER = "Джо, хозяин лавки";
const DAY_MS = 24 * 60 * 60 * 1000;

const SHOP_LINES = Object.freeze({
  closed: [
    "Лавка закрыта мастером. Проверь настройки позже.",
    "Сегодня ставни опущены. Возвращайся, когда мастер откроет торговлю.",
    "Торговля на паузе: мастер временно закрыл прилавок."
  ],
  noPurchasesLow: [
    "С малым запасом бери недорогие расходники и держи резерв.",
    "Начни с малого: один точный расходник лучше пустого кошеля.",
    "Первые траты делай аккуратно, чтобы не остаться без билетов."
  ],
  noPurchasesMid: [
    "Старт хороший: выбирай один сильный товар под ближайшую сцену.",
    "Не спеши скупать всё сразу. Одна точная покупка работает лучше.",
    "Думай на шаг вперёд: полезнее то, что сработает именно сейчас."
  ],
  noPurchasesHigh: [
    "Запас уверенный: можешь брать серьёзное усиление.",
    "Хватает на крупную покупку. Сверь лимиты и забирай лучшее.",
    "С таким балансом можно планировать сильный апгрейд."
  ],
  specialist: [
    "Вижу ставку на «{item}». Хороший фокус, если план понятен.",
    "Опять «{item}»? Узкая стратегия, но бывает очень точной.",
    "«{item}» сегодня в ходу. Продолжай, если это часть плана."
  ],
  activeBuyer: [
    "Темп покупок высокий. Проверяй лимиты, чтобы не упереться в потолок.",
    "Хороший разгон по лавке. Сохрани немного билетов на форс-мажор.",
    "Серия покупок мощная. Держи резерв на неожиданный поворот сцены."
  ],
  mixed: [
    "Собрал разнотипный набор. Это гибко и обычно надёжно.",
    "Разные позиции в корзине: видно, что готовишься к нескольким сценариям.",
    "Комбинируешь товары грамотно. Универсальность сейчас на твоей стороне."
  ],
  lowBalanceAfter: [
    "Баланс просел, дальше только точечные покупки.",
    "Остаток низкий: лучше сохранить билеты до критичной сцены.",
    "Сейчас важна экономия. Возьми паузу перед следующей покупкой."
  ],
  highBalanceAfter: [
    "Резерв всё ещё высокий. Можно усиливаться дальше по плану.",
    "Баланс комфортный: есть пространство для сильной покупки.",
    "Держишь хороший запас. Можно играть агрессивнее в выборе товаров."
  ],
  steady: [
    "Ровный ритм закупки. Так обычно и выигрывают длинную сессию.",
    "Покупки выглядят осознанно. Продолжай в том же темпе.",
    "Стабильная стратегия: без лишнего риска и без просадок."
  ]
});

export default function ShopMascotStall({ balance, ticketsEnabled, purchaseSummary }) {
  const line = getShopkeeperLine({ balance, ticketsEnabled, purchaseSummary });
  const stateLabel = ticketsEnabled ? "Открыто" : "Закрыто";
  const stateClass = ticketsEnabled ? "ok" : "off";
  const purchasesToday = Number(purchaseSummary?.totalPurchases || 0);

  return (
    <div className="shop-mascot-stall shop-mascot-stall-minimal">
      <svg
        className="shop-mascot-svg shop-sign-svg"
        viewBox="0 0 640 220"
        role="img"
        aria-label={LABEL_SIGN}
      >
        <defs>
          <linearGradient id="shopSignBack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#262a2f" />
            <stop offset="100%" stopColor="#111418" />
          </linearGradient>
          <linearGradient id="shopSignFrame" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8f9aa6" />
            <stop offset="100%" stopColor="#4c5560" />
          </linearGradient>
          <linearGradient id="shopSignPlate" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3a4149" />
            <stop offset="100%" stopColor="#232a31" />
          </linearGradient>
          <linearGradient id="shopSignCoin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d3dbe3" />
            <stop offset="100%" stopColor="#9ea8b3" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="640" height="220" fill="url(#shopSignBack)" />
        <rect x="28" y="22" width="584" height="176" rx="22" fill="rgba(18,22,27,.8)" />
        <rect x="28" y="22" width="584" height="176" rx="22" fill="none" stroke="url(#shopSignFrame)" strokeWidth="2" />

        <path d="M72 54 H568" stroke="rgba(154,162,170,.24)" strokeWidth="1.6" />
        <path d="M72 166 H568" stroke="rgba(154,162,170,.24)" strokeWidth="1.6" />

        <rect x="208" y="64" width="224" height="96" rx="18" fill="url(#shopSignPlate)" stroke="rgba(143,154,166,.42)" strokeWidth="1.5" />

        <g className="shop-sign-emblem">
          <ellipse cx="320" cy="126" rx="26" ry="8" fill="url(#shopSignCoin)" opacity=".92" />
          <ellipse cx="320" cy="118" rx="22" ry="7" fill="url(#shopSignCoin)" opacity=".9" />
          <ellipse cx="320" cy="111" rx="18" ry="6" fill="url(#shopSignCoin)" opacity=".88" />
          <circle cx="320" cy="103" r="5" fill="#d7dee6" />
        </g>

        <text x="320" y="92" textAnchor="middle" fill="#d6dde5" fontSize="26" fontWeight="700" letterSpacing=".9">
          ЛАВКА ДЖО
        </text>
        <text x="320" y="154" textAnchor="middle" fill="#98a4b0" fontSize="12" fontWeight="700" letterSpacing="1.1">
          ТОРГОВЕЦ СНАРЯЖЕНИЕМ
        </text>
      </svg>

      <div className="shop-mascot-bubble shop-mascot-bubble-minimal" aria-live="polite">
        <span className="shop-mascot-name">{NAME_SHOPKEEPER}</span>
        <span>{line}</span>
        <div className="shop-mascot-tags">
          <span className={`badge ${stateClass}`}>{stateLabel}</span>
          <span className="meta-chip">Баланс: {Number(balance || 0)}</span>
          <span className="meta-chip">Покупок сегодня: {purchasesToday}</span>
        </div>
      </div>
    </div>
  );
}

function getShopkeeperLine({ balance, ticketsEnabled, purchaseSummary }) {
  const totalPurchases = Number(purchaseSummary?.totalPurchases || 0);
  const uniqueItems = Number(purchaseSummary?.uniqueItems || 0);
  const topItemTitle = String(purchaseSummary?.topItemTitle || "").trim();
  const daySeed = Math.floor(Date.now() / DAY_MS);
  const seed = daySeed + Number(balance || 0) * 7 + totalPurchases * 11 + uniqueItems * 13;

  if (!ticketsEnabled) {
    return pickLine(SHOP_LINES.closed, seed);
  }
  if (totalPurchases <= 0) {
    if (balance <= 2) return pickLine(SHOP_LINES.noPurchasesLow, seed);
    if (balance >= 12) return pickLine(SHOP_LINES.noPurchasesHigh, seed);
    return pickLine(SHOP_LINES.noPurchasesMid, seed);
  }
  if (totalPurchases >= 4) {
    return pickLine(SHOP_LINES.activeBuyer, seed);
  }
  if (uniqueItems === 1 && totalPurchases >= 2 && topItemTitle) {
    return withItem(pickLine(SHOP_LINES.specialist, seed), topItemTitle);
  }
  if (uniqueItems >= 3) {
    return pickLine(SHOP_LINES.mixed, seed);
  }
  if (balance <= 2) {
    return pickLine(SHOP_LINES.lowBalanceAfter, seed);
  }
  if (balance >= 12) {
    return pickLine(SHOP_LINES.highBalanceAfter, seed);
  }
  return pickLine(SHOP_LINES.steady, seed);
}

function pickLine(list, seed) {
  const rows = Array.isArray(list) ? list : [];
  if (!rows.length) return "";
  const raw = Math.abs(Math.trunc(Number(seed || 0)));
  return rows[raw % rows.length];
}

function withItem(text, itemTitle) {
  return String(text || "").replace("{item}", itemTitle || "этот товар");
}
