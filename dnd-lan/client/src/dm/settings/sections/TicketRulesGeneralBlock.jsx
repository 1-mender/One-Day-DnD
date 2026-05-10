import React from "react";
import { RULE_TIPS } from "../domain/settingsConstants.js";

export default function TicketRulesGeneralBlock({
  showOnlyChanged,
  showGeneralBlock,
  generalChanges,
  showGeneralInputs,
  ticketRules,
  readOnly,
  updateTicketRules
}) {
  if (!showGeneralBlock) {
    return <div className="badge warn">{"Нет изменённых общих правил."}</div>;
  }

  return (
    <>
      {!showOnlyChanged || generalChanges.enabled ? (
        <label className="row" title={RULE_TIPS.arcadeEnabled}>
          <input
            type="checkbox"
            checked={ticketRules.enabled !== false}
            onChange={(e) => updateTicketRules({ enabled: e.target.checked })}
            disabled={readOnly}
          />
          <span>{"Включить аркаду и билеты"}</span>
        </label>
      ) : null}

      {showGeneralInputs ? (
        <div className="settings-fields">
          {!showOnlyChanged || generalChanges.dailyEarnCap ? (
            <input
              type="number"
              min="0"
              value={ticketRules.dailyEarnCap ?? 0}
              onChange={(e) => updateTicketRules({ dailyEarnCap: Number(e.target.value) || 0 })}
              placeholder={"Дневной лимит"}
              aria-label="Дневной лимит билетов"
              title={RULE_TIPS.dailyEarnCap}
              disabled={readOnly}
            />
          ) : null}
          {!showOnlyChanged || generalChanges.streakMax ? (
            <input
              type="number"
              min="0"
              value={ticketRules.streak?.max ?? 0}
              onChange={(e) => updateTicketRules({ streak: { ...(ticketRules.streak || {}), max: Number(e.target.value) || 0 } })}
              placeholder={"Серия max"}
              aria-label="Максимум серии побед"
              title={RULE_TIPS.streakMax}
              disabled={readOnly}
            />
          ) : null}
          {!showOnlyChanged || generalChanges.streakStep ? (
            <input
              type="number"
              min="0"
              step="0.01"
              value={ticketRules.streak?.step ?? 0}
              onChange={(e) => updateTicketRules({ streak: { ...(ticketRules.streak || {}), step: Number(e.target.value) || 0 } })}
              placeholder={"Серия шаг"}
              aria-label="Шаг бонуса серии"
              title={RULE_TIPS.streakStep}
              disabled={readOnly}
            />
          ) : null}
          {!showOnlyChanged || generalChanges.streakFlatBonus ? (
            <input
              type="number"
              min="0"
              value={ticketRules.streak?.flatBonus ?? 0}
              onChange={(e) => updateTicketRules({ streak: { ...(ticketRules.streak || {}), flatBonus: Number(e.target.value) || 0 } })}
              placeholder={"Бонус серии"}
              aria-label="Фиксированный бонус серии"
              title={RULE_TIPS.streakFlatBonus}
              disabled={readOnly}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
