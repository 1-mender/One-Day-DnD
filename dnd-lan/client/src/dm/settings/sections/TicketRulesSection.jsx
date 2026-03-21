import React from "react";
import { GAME_LABELS, RULE_TIPS, SHOP_LABELS } from "../domain/settingsConstants.js";

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
          {showGeneralBlock ? (
            <>
              {!showOnlyChanged || generalChanges.enabled ? (
                <label className="row" title={RULE_TIPS.arcadeEnabled}>
                  <input
                    type="checkbox"
                    checked={ticketRules.enabled !== false}
                    onChange={(e) => updateTicketRules({ enabled: e.target.checked })}
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
                    />
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="badge warn">{"Нет изменённых общих правил."}</div>
          )}

          {showDailyQuestBlock ? (
            <div className="paper-note">
              <div className="title">{"Ежедневный квест"}</div>
              <div className="settings-fields u-mt-8">
                <label className="row" title={RULE_TIPS.dailyQuestEnabled}>
                  <input
                    type="checkbox"
                    checked={ticketRules?.dailyQuest?.enabled !== false}
                    onChange={(e) => updateTicketRules({ dailyQuest: { enabled: e.target.checked } })}
                  />
                  <span>{"Включить ежедневный квест"}</span>
                </label>
                <button className="btn secondary" onClick={addDailyQuest}>+ {"Добавить"}</button>
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
                >
                  {(ticketRules?.dailyQuest?.pool || []).map((q) => (
                    <option key={q.key} value={q.key}>
                      {q.title || q.key}
                    </option>
                  ))}
                </select>
              </div>

              <div className="paper-note u-mt-8">
                <div className="title">{"Превью (игрокам)"}</div>
                {(() => {
                  const pool = ticketRules?.dailyQuest?.pool || [];
                  const activeKey = ticketRules?.dailyQuest?.activeKey || "";
                  const active = pool.find((q) => q.key === activeKey) || pool[0];
                  if (!active) return <div className="small">{"Нет активного квеста."}</div>;
                  return (
                    <div className="list">
                      <div className="small">{active.title}: {active.description}</div>
                      <div className="row u-row-gap-8 u-row-wrap u-mt-6">
                        <span className="badge">{"Прогресс: 0/"}{active.goal}</span>
                        <span className="badge secondary">{"Награда: "}{active.reward} {"билета"}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="settings-grid u-mt-8">
                {(ticketRules?.dailyQuest?.pool || []).map((q, idx) => (
                  <div key={q.key || idx} className="item settings-card">
                    <div className="settings-head">
                      <div className="u-fw-800">
                        {q.title || `Квест #${idx + 1}`}
                        {ticketRules?.dailyQuest?.activeKey === q.key ? <span className="badge ok u-ml-8">активен</span> : null}
                      </div>
                      <div className="row u-row-gap-8">
                        <label className="row u-row-gap-6" title={RULE_TIPS.dailyQuestEnabled}>
                          <input
                            type="checkbox"
                            checked={q.enabled !== false}
                            onChange={(e) => updateDailyQuest(idx, { enabled: e.target.checked })}
                          />
                          <span>{"Вкл"}</span>
                        </label>
                        <button className="btn danger" onClick={() => removeDailyQuest(idx)}>{"Удалить"}</button>
                      </div>
                    </div>
                    <div className="settings-fields">
                      <input
                        value={q.title || ""}
                        onChange={(e) => updateDailyQuest(idx, { title: e.target.value })}
                        placeholder={"Заголовок"}
                        aria-label="Заголовок ежедневного квеста"
                        maxLength={80}
                        title={RULE_TIPS.dailyQuestTitle}
                      />
                      <input
                        value={q.description || ""}
                        onChange={(e) => updateDailyQuest(idx, { description: e.target.value })}
                        placeholder={"Описание"}
                        aria-label="Описание ежедневного квеста"
                        maxLength={160}
                        title={RULE_TIPS.dailyQuestDescription}
                      />
                      <input
                        type="number"
                        min="1"
                        value={q.goal ?? 2}
                        onChange={(e) => updateDailyQuest(idx, { goal: Number(e.target.value) || 1 })}
                        placeholder={"Цель"}
                        aria-label="Цель ежедневного квеста"
                        title={RULE_TIPS.dailyQuestGoal}
                      />
                      <input
                        type="number"
                        min="0"
                        value={q.reward ?? 0}
                        onChange={(e) => updateDailyQuest(idx, { reward: Number(e.target.value) || 0 })}
                        placeholder={"Награда"}
                        aria-label="Награда ежедневного квеста"
                        title={RULE_TIPS.dailyQuestReward}
                      />
                    </div>
                    <div className="settings-sub">key: {q.key || "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="paper-note">
            <div className="title">{"Игры"}</div>
            <div className="settings-grid u-mt-8">
              {showOnlyChanged && filteredGames.length === 0 ? (
                <div className="badge warn">{"Нет изменённых правил для игр."}</div>
              ) : (
                filteredGames.map(([key, game]) => (
                  <div key={key} className="item settings-card">
                    <div className="settings-head">
                      <div className="u-fw-800">{GAME_LABELS[key] || key}</div>
                      <label className="row u-row-gap-6" title={RULE_TIPS.gameEnabled}>
                        <input
                          type="checkbox"
                          checked={game.enabled !== false}
                          onChange={(e) => updateTicketGame(key, { enabled: e.target.checked })}
                        />
                        <span>{"Вкл"}</span>
                      </label>
                    </div>
                    <div className="settings-fields">
                      <input
                        type="number"
                        min="0"
                        value={game.entryCost ?? 0}
                        onChange={(e) => updateTicketGame(key, { entryCost: Number(e.target.value) || 0 })}
                        placeholder={"Вход"}
                        aria-label={`Стоимость входа: ${GAME_LABELS[key] || key}`}
                        title={RULE_TIPS.entryCost}
                      />
                      <input
                        type="number"
                        min="0"
                        value={game.rewardMin ?? 0}
                        onChange={(e) => updateTicketGame(key, { rewardMin: Number(e.target.value) || 0 })}
                        placeholder={"Мин"}
                        aria-label={`Минимальная награда: ${GAME_LABELS[key] || key}`}
                        title={RULE_TIPS.rewardMin}
                      />
                      <input
                        type="number"
                        min="0"
                        value={game.rewardMax ?? 0}
                        onChange={(e) => updateTicketGame(key, { rewardMax: Number(e.target.value) || 0 })}
                        placeholder={"Макс"}
                        aria-label={`Максимальная награда: ${GAME_LABELS[key] || key}`}
                        title={RULE_TIPS.rewardMax}
                      />
                      <input
                        type="number"
                        min="0"
                        value={game.lossPenalty ?? 0}
                        onChange={(e) => updateTicketGame(key, { lossPenalty: Number(e.target.value) || 0 })}
                        placeholder={"Штраф"}
                        aria-label={`Штраф за поражение: ${GAME_LABELS[key] || key}`}
                        title={RULE_TIPS.lossPenalty}
                      />
                      <input
                        type="number"
                        min="0"
                        value={game.dailyLimit ?? 0}
                        onChange={(e) => updateTicketGame(key, { dailyLimit: Number(e.target.value) || 0 })}
                        placeholder={"Лимит/день"}
                        aria-label={`Дневной лимит: ${GAME_LABELS[key] || key}`}
                        title={RULE_TIPS.dailyLimit}
                      />
                    </div>
                    <div className="settings-fields">
                      <input
                        value={game.ui?.difficulty ?? ""}
                        onChange={(e) => updateTicketGame(key, { ui: { difficulty: e.target.value } })}
                        placeholder={"Сложность"}
                        aria-label={`UI сложность: ${GAME_LABELS[key] || key}`}
                        maxLength={40}
                        title={RULE_TIPS.uiDifficulty}
                      />
                      <input
                        value={game.ui?.risk ?? ""}
                        onChange={(e) => updateTicketGame(key, { ui: { risk: e.target.value } })}
                        placeholder={"Риск"}
                        aria-label={`UI риск: ${GAME_LABELS[key] || key}`}
                        maxLength={40}
                        title={RULE_TIPS.uiRisk}
                      />
                      <input
                        value={game.ui?.time ?? ""}
                        onChange={(e) => updateTicketGame(key, { ui: { time: e.target.value } })}
                        placeholder={"Время"}
                        aria-label={`UI время: ${GAME_LABELS[key] || key}`}
                        maxLength={40}
                        title={RULE_TIPS.uiTime}
                      />
                    </div>
                    <div className="settings-sub">{"Награда и штрафы задают диапазон билетов."}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="paper-note">
            <div className="title">{"Инвентарь (магазин)"}</div>
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
                      />
                      <input
                        type="number"
                        min="0"
                        value={item.dailyLimit ?? 0}
                        onChange={(e) => updateTicketShop(key, { dailyLimit: Number(e.target.value) || 0 })}
                        placeholder={"Лимит/день"}
                        aria-label={`Дневной лимит товара: ${SHOP_LABELS[key] || key}`}
                        title={RULE_TIPS.shopDailyLimit}
                      />
                    </div>
                    <div className="settings-sub">{"Лимит 0 = без ограничения."}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
