import React from "react";
import { RULE_TIPS } from "../domain/settingsConstants.js";

function DailyQuestPreview({ ticketRules }) {
  const pool = ticketRules?.dailyQuest?.pool || [];
  const activeKey = ticketRules?.dailyQuest?.activeKey || "";
  const active = pool.find((q) => q.key === activeKey) || pool[0];

  if (!active) {
    return <div className="small">{"Нет активного квеста."}</div>;
  }

  return (
    <div className="list">
      <div className="small">{active.title}: {active.description}</div>
      <div className="row u-row-gap-8 u-row-wrap u-mt-6">
        <span className="badge">{"Прогресс: 0/"}{active.goal}</span>
        <span className="badge secondary">{"Награда: "}{active.reward} {"билета"}</span>
      </div>
    </div>
  );
}

function DailyQuestCard({ quest, index, activeKey, readOnly, updateDailyQuest, removeDailyQuest }) {
  return (
    <div className="item settings-card">
      <div className="settings-head">
        <div className="u-fw-800">
          {quest.title || `Квест #${index + 1}`}
          {activeKey === quest.key ? <span className="badge ok u-ml-8">активен</span> : null}
        </div>
        <div className="row u-row-gap-8">
          <label className="row u-row-gap-6" title={RULE_TIPS.dailyQuestEnabled}>
            <input
              type="checkbox"
              checked={quest.enabled !== false}
              onChange={(e) => updateDailyQuest(index, { enabled: e.target.checked })}
              disabled={readOnly}
            />
            <span>{"Вкл"}</span>
          </label>
          <button className="btn danger" onClick={() => removeDailyQuest(index)} disabled={readOnly}>{"Удалить"}</button>
        </div>
      </div>
      <div className="settings-fields">
        <input
          value={quest.title || ""}
          onChange={(e) => updateDailyQuest(index, { title: e.target.value })}
          placeholder={"Заголовок"}
          aria-label="Заголовок ежедневного квеста"
          maxLength={80}
          title={RULE_TIPS.dailyQuestTitle}
          disabled={readOnly}
        />
        <input
          value={quest.description || ""}
          onChange={(e) => updateDailyQuest(index, { description: e.target.value })}
          placeholder={"Описание"}
          aria-label="Описание ежедневного квеста"
          maxLength={160}
          title={RULE_TIPS.dailyQuestDescription}
          disabled={readOnly}
        />
        <input
          type="number"
          min="1"
          value={quest.goal ?? 2}
          onChange={(e) => updateDailyQuest(index, { goal: Number(e.target.value) || 1 })}
          placeholder={"Цель"}
          aria-label="Цель ежедневного квеста"
          title={RULE_TIPS.dailyQuestGoal}
          disabled={readOnly}
        />
        <input
          type="number"
          min="0"
          value={quest.reward ?? 0}
          onChange={(e) => updateDailyQuest(index, { reward: Number(e.target.value) || 0 })}
          placeholder={"Награда"}
          aria-label="Награда ежедневного квеста"
          title={RULE_TIPS.dailyQuestReward}
          disabled={readOnly}
        />
      </div>
      <div className="settings-sub">key: {quest.key || "—"}</div>
    </div>
  );
}

export default function TicketRulesDailyQuestBlock({
  showDailyQuestBlock,
  ticketRules,
  updateTicketRules,
  addDailyQuest,
  resetDailyQuestToday,
  reassignDailyQuestToday,
  readOnly,
  ticketBusy,
  setActiveDailyQuest,
  updateDailyQuest,
  removeDailyQuest
}) {
  if (!showDailyQuestBlock) {
    return null;
  }

  return (
    <div className="paper-note">
      <div className="title">{"Ежедневный квест"}</div>
      <div className="settings-fields u-mt-8">
        <label className="row" title={RULE_TIPS.dailyQuestEnabled}>
          <input
            type="checkbox"
            checked={ticketRules?.dailyQuest?.enabled !== false}
            onChange={(e) => updateTicketRules({ dailyQuest: { enabled: e.target.checked } })}
            disabled={readOnly}
          />
          <span>{"Включить ежедневный квест"}</span>
        </label>
        <button className="btn secondary" onClick={addDailyQuest} disabled={readOnly}>+ {"Добавить"}</button>
        <button className="btn secondary" onClick={resetDailyQuestToday} disabled={readOnly || ticketBusy}>
          {"Сбросить на сегодня"}
        </button>
        <button className="btn secondary" onClick={reassignDailyQuestToday} disabled={readOnly || ticketBusy}>
          {"Переназначить сегодня"}
        </button>
      </div>

      <div className="settings-fields u-mt-6">
        <select
          value={ticketRules?.dailyQuest?.activeKey || ""}
          onChange={(e) => setActiveDailyQuest(e.target.value)}
          aria-label="Активный ежедневный квест"
          title={RULE_TIPS.dailyQuestTitle}
          disabled={readOnly}
        >
          {(ticketRules?.dailyQuest?.pool || []).map((quest) => (
            <option key={quest.key} value={quest.key}>
              {quest.title || quest.key}
            </option>
          ))}
        </select>
      </div>

      <div className="paper-note u-mt-8">
        <div className="title">{"Превью (игрокам)"}</div>
        <DailyQuestPreview ticketRules={ticketRules} />
      </div>

      <div className="settings-grid u-mt-8">
        {(ticketRules?.dailyQuest?.pool || []).map((quest, index) => (
          <DailyQuestCard
            key={quest.key || index}
            quest={quest}
            index={index}
            activeKey={ticketRules?.dailyQuest?.activeKey}
            readOnly={readOnly}
            updateDailyQuest={updateDailyQuest}
            removeDailyQuest={removeDailyQuest}
          />
        ))}
      </div>
    </div>
  );
}
