import React from "react";
import { RULE_TIPS } from "../domain/settingsConstants.js";
import TicketRulesDailyQuestBlock from "./TicketRulesDailyQuestBlock.jsx";
import TicketRulesGamesBlock from "./TicketRulesGamesBlock.jsx";
import TicketRulesGeneralBlock from "./TicketRulesGeneralBlock.jsx";
import TicketRulesShopBlock from "./TicketRulesShopBlock.jsx";

export default function TicketRulesSection({
  showOnlyChanged,
  setShowOnlyChanged,
  ticketDirty,
  saveTicketRules,
  resetTicketRules,
  readOnly,
  ticketBusy,
  ticketErr,
  ticketMsg,
  ticketRules,
  showGeneralBlock,
  generalChanges,
  showGeneralInputs,
  updateTicketRules,
  showDailyQuestBlock,
  addDailyQuest,
  resetDailyQuestToday,
  reassignDailyQuestToday,
  setActiveDailyQuest,
  updateDailyQuest,
  removeDailyQuest,
  filteredGames,
  updateTicketGame,
  filteredShop,
  updateTicketShop
}) {
  return (
    <div className="card taped">
      <div className="u-fw-800">{"Аркада и билеты"}</div>
      <div className="small">{"Настройка игр, лимитов и цен."}</div>
      <hr />
      <div className="row u-row-gap-8 u-row-wrap">
        <label className="row u-row-gap-6" title={RULE_TIPS.showOnlyChanged}>
          <input
            type="checkbox"
            checked={showOnlyChanged}
            onChange={(e) => setShowOnlyChanged(e.target.checked)}
            disabled={readOnly}
          />
          <span>{"Показать только изменённые"}</span>
        </label>
        {ticketDirty ? (
          <span className="badge warn">{"Есть несохранённые изменения"}</span>
        ) : (
          <span className="badge ok">{"Изменений нет"}</span>
        )}
        <button className="btn" onClick={saveTicketRules} disabled={readOnly || ticketBusy || !ticketDirty}>
          {"Сохранить"}
        </button>
        <button className="btn secondary" onClick={resetTicketRules} disabled={readOnly || ticketBusy}>
          {"Сбросить к дефолту"}
        </button>
      </div>
      {ticketErr ? <div className="badge off">{"Ошибка: "}{ticketErr}</div> : null}
      {ticketMsg ? <div className="badge ok">{ticketMsg}</div> : null}
      {!ticketRules ? (
        <div className="badge warn">{"Загрузка настроек..."}</div>
      ) : (
        <div className="list">
          <TicketRulesGeneralBlock
            showOnlyChanged={showOnlyChanged}
            showGeneralBlock={showGeneralBlock}
            generalChanges={generalChanges}
            showGeneralInputs={showGeneralInputs}
            ticketRules={ticketRules}
            readOnly={readOnly}
            updateTicketRules={updateTicketRules}
          />

          <TicketRulesDailyQuestBlock
            showDailyQuestBlock={showDailyQuestBlock}
            ticketRules={ticketRules}
            updateTicketRules={updateTicketRules}
            addDailyQuest={addDailyQuest}
            resetDailyQuestToday={resetDailyQuestToday}
            reassignDailyQuestToday={reassignDailyQuestToday}
            readOnly={readOnly}
            ticketBusy={ticketBusy}
            setActiveDailyQuest={setActiveDailyQuest}
            updateDailyQuest={updateDailyQuest}
            removeDailyQuest={removeDailyQuest}
          />

          <TicketRulesGamesBlock
            showOnlyChanged={showOnlyChanged}
            filteredGames={filteredGames}
            readOnly={readOnly}
            updateTicketGame={updateTicketGame}
          />

          <TicketRulesShopBlock
            showOnlyChanged={showOnlyChanged}
            filteredShop={filteredShop}
            readOnly={readOnly}
            ticketRules={ticketRules}
            generalChanges={generalChanges}
            updateTicketRules={updateTicketRules}
            updateTicketShop={updateTicketShop}
          />
        </div>
      )}
    </div>
  );
}
