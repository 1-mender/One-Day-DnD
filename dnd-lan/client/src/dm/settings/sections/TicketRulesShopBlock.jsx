import React from "react";
import { RULE_TIPS, SHOP_LABELS } from "../domain/settingsConstants.js";

export default function TicketRulesShopBlock({
  showOnlyChanged,
  filteredShop,
  readOnly,
  ticketRules,
  generalChanges,
  updateTicketRules,
  updateTicketShop
}) {
  return (
    <div className="paper-note">
      <div className="title">{"Лавка (магазин)"}</div>
      {!showOnlyChanged || generalChanges?.dailyShopCap ? (
        <div className="settings-fields u-mt-8">
          <div className="settings-sub">{"Общий лимит покупок в лавке на одного игрока за день"}</div>
          <input
            type="number"
            min="0"
            value={ticketRules?.dailyShopCap ?? 0}
            onChange={(e) => updateTicketRules({ dailyShopCap: Number(e.target.value) || 0 })}
            placeholder={"Покупок/день на игрока"}
            aria-label="Дневной лимит покупок лавки на игрока"
            title={RULE_TIPS.dailyShopCap}
            disabled={readOnly}
          />
        </div>
      ) : null}
      <div className="settings-sub">{"Общий лимит 0 = без ограничения по количеству покупок за день."}</div>
      <div className="settings-grid u-mt-8">
        {showOnlyChanged && filteredShop.length === 0 ? (
          <div className="badge warn">{"Нет изменённых правил для магазина."}</div>
        ) : (
          filteredShop.map(([key, item]) => (
            <div key={key} className="item settings-card">
              <div className="settings-head">
                <div className="u-fw-800">{SHOP_LABELS[key] || key}</div>
                <label className="row u-row-gap-6" title={RULE_TIPS.shopEnabled}>
                  <input
                    type="checkbox"
                    checked={item.enabled !== false}
                    onChange={(e) => updateTicketShop(key, { enabled: e.target.checked })}
                    disabled={readOnly}
                  />
                  <span>{"Вкл"}</span>
                </label>
              </div>
              <div className="settings-fields">
                <input
                  type="number"
                  min="0"
                  value={item.price ?? 0}
                  onChange={(e) => updateTicketShop(key, { price: Number(e.target.value) || 0 })}
                  placeholder={"Цена"}
                  aria-label={`Цена товара: ${SHOP_LABELS[key] || key}`}
                  title={RULE_TIPS.shopPrice}
                  disabled={readOnly}
                />
                <input
                  type="number"
                  min="0"
                  value={item.dailyLimit ?? 0}
                  onChange={(e) => updateTicketShop(key, { dailyLimit: Number(e.target.value) || 0 })}
                  placeholder={"Лимит/день"}
                  aria-label={`Дневной лимит товара: ${SHOP_LABELS[key] || key}`}
                  title={RULE_TIPS.shopDailyLimit}
                  disabled={readOnly}
                />
              </div>
              <div className="settings-sub">{"Лимит 0 = без ограничения."}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
