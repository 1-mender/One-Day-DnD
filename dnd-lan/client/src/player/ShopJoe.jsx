import React from "react";
import { useTickets } from "../hooks/useTickets.js";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { formatError } from "../lib/formatError.js";

const catalog = [
  {
    key: "boosts",
    title: "Основные улучшения",
    subtitle: "Редкие, сильные эффекты с лимитами",
    items: [
      {
        key: "stat",
        title: "+1 к характеристике",
        blurb: "Выбери STR/DEX/CON/INT/WIS/CHA. Закрепляется в профиле.",
        price: 12,
        impact: "Сильное",
        limit: "1 на персонажа",
        note: "Требует одобрения DM"
      },
      {
        key: "feat",
        title: "Памятка-талант",
        blurb: "Тематический бонус с небольшим эффектом по решению DM.",
        price: 15,
        impact: "Сильное",
        limit: "1 за сессию",
        note: "История и роль важнее цифр"
      }
    ]
  },
  {
    key: "consumables",
    title: "Расходники",
    subtitle: "Тактические решения в ключевой момент",
    items: [
      {
        key: "reroll",
        title: "1 переброс кубика",
        blurb: "Один раз заменить результат броска на новый.",
        price: 4,
        impact: "Тактика",
        limit: "2 за сессию",
        note: "Можно применить после броска"
      },
      {
        key: "luck",
        title: "Печать удачи",
        blurb: "+1 к броску на один эпизод, действует до финала сцены.",
        price: 3,
        impact: "Тактика",
        limit: "3 за сессию",
        note: "Стакается с вдохновением"
      }
    ]
  },
  {
    key: "mystery",
    title: "Сюрпризы",
    subtitle: "Риск ради неожиданных сюжетных поворотов",
    items: [
      {
        key: "chest",
        title: "Сундук с сюрпризом",
        blurb: "Случайная награда из списка DM: артефакт, ключ или подсказка.",
        price: 7,
        impact: "Риск",
        limit: "1 за сессию",
        note: "Награда зависит от удачи"
      },
      {
        key: "hint",
        title: "Тайная подсказка",
        blurb: "Одна подсказка по сцене или персонажу.",
        price: 5,
        impact: "Риск",
        limit: "2 за сессию",
        note: "Лор раскрывается глубже"
      }
    ]
  }
];

function priceLabel(price) {
  if (!Number.isFinite(price)) return "—";
  const qty = Number(price);
  return `${qty} ${qty === 1 ? "билет" : qty < 5 ? "билета" : "билетов"}`;
}

export default function ShopJoe() {
  const toast = useToast();
  const { state, rules, usage, loading, err, purchase, readOnly } = useTickets();
  const balance = Number(state?.balance || 0);
  const ticketsEnabled = rules?.enabled !== false;

  async function handleBuy(itemKey) {
    if (!ticketsEnabled) {
      toast.error("Магазин закрыт DM.");
      return;
    }
    try {
      const res = await purchase({ itemKey });
      const price = res?.result?.price ?? rules?.shop?.[itemKey]?.price ?? 0;
      toast.success(`-${price} билетов`, "Покупка успешна");
    } catch (e) {
      const msg = formatTicketError(formatError(e));
      toast.error(msg);
    }
  }

  return (
    <div className="card taped shop-shell">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="shop-title">Джо • Магазин билетов</div>
          <div className="small">Билеты имеют вес: сильные бонусы ограничены.</div>
        </div>
        <div className="ticket-bank">
          <div className="ticket-card">
            <div className="ticket-label">Баланс</div>
            <div className="ticket-value">{loading ? "…" : balance}</div>
          </div>
          <div className="ticket-meta small">Лучшие товары требуют серии побед.</div>
        </div>
      </div>
      <div className="shop-banner">
        <div className="banner-title">Билеты — это выбор</div>
        <div className="small">
          Легендарные эффекты ограничены, а расходники решают исход сцены.
        </div>
      </div>
      {!ticketsEnabled ? (
        <div className="badge off" style={{ marginTop: 8 }}>Магазин закрыт DM</div>
      ) : null}
      {err ? <div className="badge off" style={{ marginTop: 8 }}>Ошибка билетов: {err}</div> : null}
      <hr />

      <div className="list">
        {catalog.map((section) => (
          <div key={section.key} className="paper-note">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="title">{section.title}</div>
              <div className="small">{section.subtitle}</div>
            </div>
            <div className="shop-grid" style={{ marginTop: 10 }}>
              {section.items.map((item) => (
                <div
                  key={item.key}
                  className={`item taped shop-card${rules?.shop?.[item.key]?.enabled === false ? " disabled-card" : ""}`}
                >
                  <div className="shop-head">
                    <div className="shop-item-title">{item.title}</div>
                    <span className={`badge ${rules?.shop?.[item.key]?.enabled === false ? "off" : `badge-impact ${impactClass(item.impact)}`}`}>
                      {rules?.shop?.[item.key]?.enabled === false ? "Закрыто" : item.impact}
                    </span>
                  </div>
                  <div className="small">{item.blurb}</div>
                  <div className="shop-meta">
                    <span className="meta-chip">
                      Лимит: {formatLimit(item.key, item.limit, rules?.shop?.[item.key]?.dailyLimit)}
                    </span>
                    <span className="meta-chip">{item.note}</span>
                    {rules?.shop?.[item.key]?.dailyLimit ? (
                      <span className="meta-chip">
                        Сегодня: {usage?.purchasesToday?.[item.key] || 0}/{rules.shop[item.key].dailyLimit}
                      </span>
                    ) : null}
                  </div>
                  <div className="row shop-actions" style={{ justifyContent: "space-between" }}>
                    <span className="ticket-pill">{priceLabel(resolvePrice(item.key, item.price, rules))}</span>
                    <button
                      className="btn secondary"
                      disabled={
                        readOnly ||
                        err ||
                        !rules ||
                        !ticketsEnabled ||
                        rules?.shop?.[item.key]?.enabled === false ||
                        balance < resolvePrice(item.key, item.price, rules) ||
                        isLimitReached(item.key, rules, usage)
                      }
                      onClick={() => handleBuy(item.key)}
                    >
                      Купить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function impactClass(label) {
  const v = String(label || "").toLowerCase();
  if (v.includes("сильн")) return "impact-high";
  if (v.includes("риск")) return "impact-high";
  if (v.includes("тактик")) return "impact-mid";
  return "impact-low";
}

function resolvePrice(itemKey, fallback, rules) {
  const price = rules?.shop?.[itemKey]?.price;
  return Number.isFinite(price) ? price : Number(fallback || 0);
}

function formatLimit(itemKey, fallback, dailyLimit) {
  if (dailyLimit) return `до ${dailyLimit} в день`;
  return fallback || "—";
}

function isLimitReached(itemKey, rules, usage) {
  const lim = rules?.shop?.[itemKey]?.dailyLimit;
  if (!lim) return false;
  const used = usage?.purchasesToday?.[itemKey] || 0;
  return used >= lim;
}

function formatTicketError(code) {
  const c = String(code || "");
  if (c === "tickets_disabled") return "Магазин временно закрыт.";
  if (c === "item_disabled") return "Этот товар сейчас недоступен.";
  if (c === "not_enough_tickets") return "Недостаточно билетов для покупки.";
  if (c === "daily_item_limit") return "Достигнут дневной лимит покупок.";
  if (c === "daily_spend_cap") return "Достигнут дневной лимит трат.";
  if (c === "invalid_item") return "Этот товар недоступен.";
  return c || "Ошибка";
}
