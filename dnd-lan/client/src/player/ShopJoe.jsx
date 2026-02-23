import React from "react";
import { useTickets } from "../hooks/useTickets.js";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { formatError } from "../lib/formatError.js";
import ShopMascotStall from "./shop/ShopMascotStall.jsx";
import { buildShopCatalog } from "./shop/shopCatalog.js";

function ticketWord(value) {
  const abs = Math.abs(Number(value || 0)) % 100;
  const tail = abs % 10;
  if (abs > 10 && abs < 20) return "билетов";
  if (tail === 1) return "билет";
  if (tail >= 2 && tail <= 4) return "билета";
  return "билетов";
}

function priceLabel(price) {
  if (!Number.isFinite(price)) return "-";
  const qty = Number(price);
  return `${qty} ${ticketWord(qty)}`;
}

export default function ShopJoe() {
  const toast = useToast();
  const { state, rules, usage, loading, err, purchase, readOnly } = useTickets();
  const [pendingItemKey, setPendingItemKey] = React.useState("");
  const pendingRef = React.useRef(false);
  const errorToastRef = React.useRef({ message: "", at: 0 });

  const balance = Number(state?.balance || 0);
  const ticketsEnabled = rules?.enabled !== false;
  const catalog = React.useMemo(() => buildShopCatalog(rules?.shop), [rules?.shop]);

  function toastPurchaseError(error) {
    const message = formatError(error);
    const now = Date.now();
    const prev = errorToastRef.current;
    if (prev.message === message && now - prev.at < 2500) return;
    errorToastRef.current = { message, at: now };
    toast.error(message);
  }

  async function handleBuy(itemKey) {
    if (pendingRef.current) return;
    if (!ticketsEnabled) {
      toast.error("Лавка закрыта мастером.");
      return;
    }
    if (!rules?.shop?.[itemKey]) {
      toast.error("Товар отсутствует в текущих правилах лавки.");
      return;
    }

    pendingRef.current = true;
    setPendingItemKey(itemKey);
    try {
      const res = await purchase({ itemKey });
      const price = res?.result?.price ?? rules?.shop?.[itemKey]?.price ?? 0;
      toast.success(`-${price} ${ticketWord(price)}`, "Покупка оформлена");
    } catch (e) {
      toastPurchaseError(e);
    } finally {
      pendingRef.current = false;
      setPendingItemKey("");
    }
  }

  return (
    <div className="card taped shop-shell tavern-shop">
      <div className="row shop-hero">
        <div className="shop-hero-copy">
          <div className="shop-kicker">{"Темная таверна • тёплая лампа"}</div>
          <div className="shop-title">{"Лавка Джо"}</div>
          <div className="small">
            {"Билеты имеют цену: чем сильнее эффект, тем строже лимиты."}
          </div>
        </div>
        <div className="ticket-bank">
          <div className="ticket-card">
            <div className="ticket-label">{"Баланс"}</div>
            <div className="ticket-value">{loading ? "..." : balance}</div>
          </div>
          <div className="ticket-meta small">{"Крупные покупки лучше делать после серии побед."}</div>
        </div>
      </div>

      <ShopMascotStall balance={balance} ticketsEnabled={ticketsEnabled} />

      <div className="shop-banner">
        <div className="banner-title">{"Каждый билет меняет историю"}</div>
        <div className="small">{"Эпические усиления редки, а расходники стабилизируют сцену."}</div>
      </div>
      {!ticketsEnabled ? (
        <div className="badge off" style={{ marginTop: 8 }}>{"Лавка временно закрыта мастером"}</div>
      ) : null}
      {err ? <div className="badge off" style={{ marginTop: 8 }}>{"Ошибка билетов: "}{err}</div> : null}
      {rules && catalog.length === 0 ? (
        <div className="badge warn" style={{ marginTop: 8 }}>{"В текущих правилах лавки нет доступных товаров."}</div>
      ) : null}
      <hr />

      <div className="list">
        {catalog.map((section) => (
          <div key={section.key} className="paper-note tavern-section">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="title">{section.title}</div>
              <div className="small">{section.subtitle}</div>
            </div>
            <div className="shop-grid" style={{ marginTop: 10 }}>
              {section.items.map((item) => {
                const itemRule = rules?.shop?.[item.key];
                const itemMissingInRules = !!rules && !itemRule;
                const itemDisabled = itemRule?.enabled === false;
                const cardBlocked = itemMissingInRules || itemDisabled;
                const dailyLimit = itemRule?.dailyLimit;
                const usedToday = usage?.purchasesToday?.[item.key] || 0;
                const itemPrice = resolvePrice(item.key, item.price, rules);
                const limitReached = isLimitReached(item.key, rules, usage);
                const disabledReason = getBuyDisabledReason({
                  readOnly,
                  loading,
                  rules,
                  ticketsEnabled,
                  itemDisabled,
                  itemMissingInRules,
                  balance,
                  itemPrice,
                  limitReached,
                  pendingItemKey,
                  itemKey: item.key
                });
                const isDisabled = !!disabledReason;
                const isPendingThis = pendingItemKey === item.key;

                return (
                  <div key={item.key} className={`item taped shop-card${cardBlocked ? " disabled-card" : ""}`}>
                    <div className="shop-head">
                      <div className="shop-item-title">{item.title}</div>
                      <span className={`badge ${cardBlocked ? "off" : `badge-impact ${item.impactClass}`}`}>
                        {itemMissingInRules ? "Нет в правилах" : itemDisabled ? "Закрыто" : item.impact}
                      </span>
                    </div>
                    <div className="small">{item.blurb}</div>
                    <div className="shop-meta">
                      <span className="meta-chip">
                        {"Лимит: "}{formatLimit(item.limit, dailyLimit)}
                      </span>
                      <span className="meta-chip">{item.note}</span>
                      {dailyLimit ? (
                        <span className="meta-chip">
                          {"Сегодня: "}{usedToday}/{dailyLimit}
                        </span>
                      ) : null}
                    </div>
                    <div className="row shop-actions" style={{ justifyContent: "space-between" }}>
                      <span className="ticket-pill">{priceLabel(itemPrice)}</span>
                      <button
                        className="btn secondary"
                        disabled={isDisabled}
                        title={disabledReason || "Купить"}
                        onClick={() => handleBuy(item.key)}
                      >
                        {isPendingThis ? "Покупаем..." : "Купить"}
                      </button>
                    </div>
                    {disabledReason ? <div className="small">{disabledReason}</div> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function resolvePrice(itemKey, fallback, rules) {
  const price = rules?.shop?.[itemKey]?.price;
  return Number.isFinite(price) ? price : Number(fallback || 0);
}

function formatLimit(fallback, dailyLimit) {
  if (dailyLimit) return `до ${dailyLimit} в день`;
  return fallback || "-";
}

function isLimitReached(itemKey, rules, usage) {
  const lim = rules?.shop?.[itemKey]?.dailyLimit;
  if (!lim) return false;
  const used = usage?.purchasesToday?.[itemKey] || 0;
  return used >= lim;
}

function getBuyDisabledReason({
  readOnly,
  loading,
  rules,
  ticketsEnabled,
  itemDisabled,
  itemMissingInRules,
  balance,
  itemPrice,
  limitReached,
  pendingItemKey,
  itemKey
}) {
  if (pendingItemKey && pendingItemKey === itemKey) return "Покупка уже выполняется...";
  if (pendingItemKey) return "Дождитесь завершения текущей покупки.";
  if (readOnly) return "Режим только чтения.";
  if (!rules) return loading ? "Загружаем правила магазина..." : "Правила магазина недоступны.";
  if (!ticketsEnabled) return "Лавка закрыта мастером.";
  if (itemMissingInRules) return "Товар отсутствует в текущих правилах лавки.";
  if (itemDisabled) return "Товар отключен мастером.";
  if (limitReached) return "Дневной лимит по товару исчерпан.";
  if (balance < itemPrice) return "Недостаточно билетов.";
  return "";
}
