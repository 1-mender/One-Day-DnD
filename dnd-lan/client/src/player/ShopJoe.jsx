import React from "react";
import { Coins, Sparkles } from "lucide-react";
import { useTickets } from "../hooks/useTickets.js";
import { useToast } from "../foundation/providers/index.js";
import { formatError } from "../lib/formatError.js";
import { getInventoryIcon } from "../lib/inventoryIcons.js";
import ShopMascotStall from "./shop/ShopMascotStall.jsx";
import ChestOpenModal from "./shop/ChestOpenModal.jsx";
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
  const [openedChestReward, setOpenedChestReward] = React.useState(null);
  const [showAllLimits, setShowAllLimits] = React.useState(false);
  const pendingRef = React.useRef(false);
  const errorToastRef = React.useRef({ message: "", at: 0 });

  const balance = Number(state?.balance || 0);
  const totalPurchasesToday = getTotalPurchasesToday(usage);
  const dailyShopCap = Number(rules?.dailyShopCap || 0);
  const shopDailyCapReached = dailyShopCap > 0 && totalPurchasesToday >= dailyShopCap;
  const remainingShopPurchases = dailyShopCap > 0
    ? Math.max(0, dailyShopCap - totalPurchasesToday)
    : null;
  const ticketsEnabled = rules?.enabled !== false;
  const catalog = React.useMemo(() => buildShopCatalog(rules?.shop), [rules?.shop]);
  const itemTitleMap = React.useMemo(() => buildItemTitleMap(catalog), [catalog]);
  const purchaseSummary = React.useMemo(
    () => buildPurchaseSummary(usage, itemTitleMap),
    [usage, itemTitleMap]
  );
  const totalPurchases = Number(purchaseSummary?.totalPurchases || 0);
  const topItemTitle = purchaseSummary?.topItemTitle || "—";
  const shopSections = React.useMemo(() => {
    return catalog
      .map((section) => {
        const items = section.items
          .map((item) => {
            const itemRule = rules?.shop?.[item.key];
            const itemMissingInRules = !!rules && !itemRule;
            const itemDisabled = itemRule?.enabled === false;
            const dailyLimit = itemRule?.dailyLimit;
            const usedToday = usage?.purchasesToday?.[item.key] || 0;
            const remainingToday = dailyLimit ? Math.max(0, Number(dailyLimit) - Number(usedToday || 0)) : null;
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
              shopDailyCapReached,
              pendingItemKey,
              itemKey: item.key
            });
            const isDisabled = !!disabledReason;
            const isPendingThis = pendingItemKey === item.key;
            const isAvailableNow = !isDisabled;
            const canExistInCatalog = !itemMissingInRules && !itemDisabled;
            return {
              ...item,
              itemRule,
              itemMissingInRules,
              itemDisabled,
              dailyLimit,
              usedToday,
              remainingToday,
              itemPrice,
              limitReached,
              disabledReason,
              isDisabled,
              isPendingThis,
              isAvailableNow,
              canExistInCatalog
            };
          })
          .sort((left, right) => {
            const leftRank = left.isAvailableNow ? 0 : 1;
            const rightRank = right.isAvailableNow ? 0 : 1;
            if (leftRank !== rightRank) return leftRank - rightRank;
            if (left.itemPrice !== right.itemPrice) return left.itemPrice - right.itemPrice;
            return String(left.title || left.key).localeCompare(String(right.title || right.key), "ru");
          });

        const availableCount = items.filter((item) => item.isAvailableNow).length;
        const enabledItems = items.filter((item) => item.canExistInCatalog && !item.limitReached);
        const cheapestEnabledPrice = enabledItems.length
          ? Math.min(...enabledItems.map((item) => item.itemPrice))
          : null;

        return {
          ...section,
          items,
          availableCount,
          cheapestEnabledPrice
        };
      })
      .sort((left, right) => {
        const leftRank = left.availableCount > 0 ? 0 : 1;
        const rightRank = right.availableCount > 0 ? 0 : 1;
        if (leftRank !== rightRank) return leftRank - rightRank;
        const leftPrice = left.cheapestEnabledPrice ?? Number.POSITIVE_INFINITY;
        const rightPrice = right.cheapestEnabledPrice ?? Number.POSITIVE_INFINITY;
        if (leftPrice !== rightPrice) return leftPrice - rightPrice;
        return String(left.title || left.key).localeCompare(String(right.title || right.key), "ru");
      });
  }, [balance, catalog, loading, pendingItemKey, readOnly, rules, shopDailyCapReached, ticketsEnabled, usage]);

  const availableNowCount = React.useMemo(
    () => shopSections.reduce((acc, section) => acc + section.availableCount, 0),
    [shopSections]
  );
  const availableSectionCount = React.useMemo(
    () => shopSections.filter((section) => section.availableCount > 0).length,
    [shopSections]
  );
  const shopLimitItems = React.useMemo(() => (
    shopSections
      .flatMap((section) => section.items)
      .filter((item) => Number(item.dailyLimit || 0) > 0)
      .sort((left, right) => {
        const leftRemaining = Number(left.remainingToday ?? 0);
        const rightRemaining = Number(right.remainingToday ?? 0);
        if (leftRemaining !== rightRemaining) return leftRemaining - rightRemaining;
        return String(left.title || left.key).localeCompare(String(right.title || right.key), "ru");
      })
  ), [shopSections]);
  const visibleShopLimitItems = React.useMemo(
    () => (showAllLimits ? shopLimitItems : shopLimitItems.slice(0, 4)),
    [shopLimitItems, showAllLimits]
  );
  const cheapestEnabledPrice = React.useMemo(() => {
    const prices = shopSections
      .map((section) => section.cheapestEnabledPrice)
      .filter((price) => Number.isFinite(price));
    return prices.length ? Math.min(...prices) : null;
  }, [shopSections]);
  const ticketsNeededForCheapest = Number.isFinite(cheapestEnabledPrice)
    ? Math.max(0, Number(cheapestEnabledPrice) - balance)
    : 0;

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
      const itemTitle = itemTitleMap[itemKey] || toHumanLabel(itemKey);
      const nextBalance = Number.isFinite(Number(res?.state?.balance))
        ? Number(res.state.balance)
        : Math.max(0, balance - Number(price || 0));
      const receipt = `Товар: ${itemTitle} • Списано: ${priceLabel(price)} • Остаток: ${nextBalance} ${ticketWord(nextBalance)}`;
      if (itemKey === "chest" && res?.result?.reward?.type === "inventory_item") {
        setOpenedChestReward(res.result.reward);
      }
      toast.success(receipt, "Чек лавки Джо");
    } catch (e) {
      toastPurchaseError(e);
    } finally {
      pendingRef.current = false;
      setPendingItemKey("");
    }
  }

  return (
    <div className="card taped shop-shell tavern-shop tf-shell tf-shop-shell">
      <div className="shop-hero tf-panel tf-command-bar shop-counter-panel">
        <div className="shop-counter-top">
          <div className="shop-hero-copy tf-page-head-main">
            <div className="shop-kicker tf-overline">{"Merchant counter"}</div>
            <div className="shop-title tf-page-title">{"Лавка Джо"}</div>
            <div className="small">
              {"Билеты тратятся на усиления, сюжетные эффекты и редкие покупки."}
            </div>
          </div>
          <div className="shop-counter-display">
            <div className="shop-counter-token" aria-hidden="true">
              <div className="shop-counter-token-core">
                <Coins className="icon" />
              </div>
              <div className="shop-counter-token-mark">
                <Sparkles className="icon" />
              </div>
            </div>
            <div className="shop-counter-balance">
              <div className="shop-counter-balance-kicker">Баланс</div>
              <div className="shop-counter-balance-value">{loading ? "..." : balance}</div>
              <div className="shop-counter-balance-unit">{ticketWord(balance)}</div>
            </div>
          </div>
        </div>
        <div className="shop-overview shop-counter-overview">
        <span className="badge ok">Доступно сейчас: {availableNowCount}</span>
        {dailyShopCap > 0 ? (
          <span className={`badge ${shopDailyCapReached ? "warn" : "secondary"}`}>
            Покупок до лимита: {remainingShopPurchases}/{dailyShopCap}
          </span>
        ) : null}
        {Number.isFinite(cheapestEnabledPrice) ? (
          <span className="badge">Мин. цена: {priceLabel(cheapestEnabledPrice)}</span>
        ) : null}
        </div>
        <div className="small shop-counter-note">Крупные покупки лучше делать после серии побед.</div>
      </div>
      {ticketsEnabled && (dailyShopCap > 0 || (availableNowCount === 0 && Number.isFinite(cheapestEnabledPrice))) ? (
        <div className="small shop-overview-hint">
          {shopDailyCapReached
            ? "На сегодня общий лимит покупок в лавке уже исчерпан."
            : dailyShopCap > 0
              ? `Сегодня в лавке осталось ещё ${remainingShopPurchases} покупок.`
              : `До первой покупки не хватает ещё ${ticketsNeededForCheapest} ${ticketWord(ticketsNeededForCheapest)}.`}
        </div>
      ) : null}

      <div className="shop-summary tf-stat-grid">
        <div className="tf-stat-card">
          <div className="small">Доступно секций</div>
          <strong>{availableSectionCount}</strong>
        </div>
        <div className="tf-stat-card">
          <div className="small">Покупок сегодня</div>
          <strong>{totalPurchases}</strong>
        </div>
        <div className="tf-stat-card">
          <div className="small">Фаворит дня</div>
          <strong>{topItemTitle}</strong>
        </div>
      </div>
      {(dailyShopCap > 0 || shopLimitItems.length > 0) ? (
        <div className="shop-banner tf-panel tf-command-bar shop-limit-banner" style={{ marginTop: 10 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div className="banner-title">{"Ограничения на сегодня"}</div>
            {shopLimitItems.length > 4 ? (
              <button
                type="button"
                className="btn secondary shop-limit-toggle"
                onClick={() => setShowAllLimits((prev) => !prev)}
              >
                {showAllLimits ? "Свернуть" : "Показать все"}
              </button>
            ) : null}
          </div>
          <div className="shop-overview">
            {dailyShopCap > 0 ? (
              <span className={`badge ${shopDailyCapReached ? "warn" : getLimitTone(remainingShopPurchases, dailyShopCap)}`}>
                Общий лимит: {remainingShopPurchases}/{dailyShopCap}
              </span>
            ) : null}
            {visibleShopLimitItems.map((item) => (
              <span key={item.key} className={`badge ${getLimitTone(item.remainingToday, item.dailyLimit)}`}>
                {item.title}: {item.remainingToday}/{item.dailyLimit}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <ShopMascotStall
        balance={balance}
        ticketsEnabled={ticketsEnabled}
        purchaseSummary={purchaseSummary}
      />

      <div className="shop-banner tf-panel tf-command-bar">
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
        {shopSections.map((section) => (
          <div key={section.key} className="paper-note tavern-section tf-panel tf-shop-section">
            <div className="row shop-section-head" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="tf-section-copy">
                <div className="tf-section-kicker">{"Merchant shelf"}</div>
                <div className="title shop-section-title">{section.title}</div>
              </div>
              <div className="shop-section-meta">
                {section.availableCount > 0 ? (
                  <span className="badge ok">Можно купить: {section.availableCount}</span>
                ) : null}
                <div className="small shop-section-subtitle">{section.subtitle}</div>
              </div>
            </div>
            <div className="shop-grid" style={{ marginTop: 10 }}>
              {section.items.map((item) => {
                const cardBlocked = item.itemMissingInRules || item.itemDisabled;
                const ItemIcon = getInventoryIcon(item.iconKey);

                return (
                  <div key={item.key} className={`item taped shop-card tf-shop-card${cardBlocked ? " disabled-card" : ""}${item.isAvailableNow ? " is-buyable" : " is-locked"}`}>
                    <div className="shop-head">
                      <div className="shop-title-wrap">
                        {ItemIcon ? (
                          <span className="shop-item-icon" aria-hidden="true">
                            <ItemIcon />
                          </span>
                        ) : null}
                        <div className="shop-item-title">{item.title}</div>
                      </div>
                      <span className={`badge ${cardBlocked ? "off" : `badge-impact ${item.impactClass}`}`}>
                        {item.itemMissingInRules ? "Нет в правилах" : item.itemDisabled ? "Закрыто" : item.impact}
                      </span>
                    </div>
                    <div className="small shop-card-blurb">{item.blurb}</div>
                    <div className="shop-meta">
                      <span className="meta-chip tf-shop-chip">
                        {"Лимит: "}{formatLimit(item.limit, item.dailyLimit)}
                      </span>
                      {item.dailyLimit ? (
                        <span className={`meta-chip tf-shop-chip ${getShopLimitChipClass(item.remainingToday, item.dailyLimit)}`}>
                          {"Осталось сегодня: "}{item.remainingToday}/{item.dailyLimit}
                        </span>
                      ) : null}
                    </div>
                    <div className="small shop-note-text">{item.note}</div>
                    {item.isAvailableNow ? (
                      <div className="row shop-actions shop-actions-live" style={{ justifyContent: "space-between" }}>
                        <span className="ticket-pill tf-shop-price">{priceLabel(item.itemPrice)}</span>
                        <button
                          className="btn secondary tf-shop-buy-btn"
                          title={item.key === "chest" ? "Открыть сундук" : "Купить"}
                          onClick={() => handleBuy(item.key)}
                        >
                          {item.isPendingThis ? (item.key === "chest" ? "Открываем..." : "Покупаем...") : (item.key === "chest" ? "Открыть" : "Купить")}
                        </button>
                      </div>
                    ) : (
                      <div className="shop-status-card">
                        <span className="ticket-pill tf-shop-price tf-shop-price-disabled">{priceLabel(item.itemPrice)}</span>
                        <div className="small shop-disabled-note">{item.disabledReason}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <ChestOpenModal
        open={!!openedChestReward}
        reward={openedChestReward}
        onClose={() => setOpenedChestReward(null)}
      />
    </div>
  );
}

function buildItemTitleMap(catalog) {
  const map = {};
  for (const section of Array.isArray(catalog) ? catalog : []) {
    for (const item of Array.isArray(section?.items) ? section.items : []) {
      if (!item?.key) continue;
      map[item.key] = String(item.title || "").trim() || toHumanLabel(item.key);
    }
  }
  return map;
}

function buildPurchaseSummary(usage, itemTitleMap) {
  const rows = Object.entries(usage?.purchasesToday || {})
    .map(([key, raw]) => [String(key), Math.max(0, Number(raw || 0))])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  const totalPurchases = rows.reduce((acc, [, count]) => acc + count, 0);
  const uniqueItems = rows.length;
  const topItemKey = rows[0]?.[0] || "";
  const topItemCount = rows[0]?.[1] || 0;
  return {
    totalPurchases,
    uniqueItems,
    topItemKey,
    topItemCount,
    topItemTitle: topItemKey ? (itemTitleMap[topItemKey] || toHumanLabel(topItemKey)) : ""
  };
}

function getTotalPurchasesToday(usage) {
  return Object.values(usage?.purchasesToday || {}).reduce((sum, raw) => sum + Math.max(0, Number(raw || 0)), 0);
}

function toHumanLabel(value) {
  return String(value || "")
    .trim()
    .replace(/[\s_]+/g, " ")
    .replace(/^\w/, (ch) => ch.toUpperCase());
}

function resolvePrice(itemKey, fallback, rules) {
  const price = rules?.shop?.[itemKey]?.price;
  return Number.isFinite(price) ? price : Number(fallback || 0);
}

function formatLimit(fallback, dailyLimit) {
  if (dailyLimit) return `до ${dailyLimit} в день`;
  return fallback || "-";
}

function getLimitTone(remaining, total) {
  const safeTotal = Math.max(0, Number(total || 0));
  const safeRemaining = Math.max(0, Number(remaining || 0));
  if (!safeTotal) return "secondary";
  if (safeRemaining <= 0) return "warn";
  if (safeRemaining <= Math.ceil(safeTotal / 2)) return "badge-limit-low";
  return "ok";
}

function getShopLimitChipClass(remaining, total) {
  const safeTotal = Math.max(0, Number(total || 0));
  const safeRemaining = Math.max(0, Number(remaining || 0));
  if (!safeTotal) return "";
  if (safeRemaining <= 0) return "is-exhausted";
  if (safeRemaining <= Math.ceil(safeTotal / 2)) return "is-low";
  return "is-healthy";
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
  shopDailyCapReached,
  pendingItemKey,
  itemKey
}) {
  if (pendingItemKey && pendingItemKey === itemKey) return "Покупка уже выполняется...";
  if (pendingItemKey) return "Дождитесь завершения текущей покупки.";
  if (readOnly) return "Режим только чтения.";
  if (!rules) return loading ? "Загружаем правила магазина..." : "Правила магазина недоступны.";
  if (!ticketsEnabled) return "Лавка закрыта мастером.";
  if (shopDailyCapReached) return "Общий дневной лимит покупок уже исчерпан.";
  if (itemMissingInRules) return "Товар отсутствует в текущих правилах лавки.";
  if (itemDisabled) return "Товар отключен мастером.";
  if (limitReached) return "Дневной лимит по товару исчерпан.";
  if (balance < itemPrice) return "Недостаточно билетов.";
  return "";
}
