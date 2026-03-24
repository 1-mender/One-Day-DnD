import React from "react";
import { GAME_LABELS, RULE_TIPS } from "../domain/settingsConstants.js";

export default function TicketRulesGamesBlock({ showOnlyChanged, filteredGames, updateTicketGame }) {
  return (
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
  );
}
