import React from "react";
import ConfirmModal from "../components/ConfirmModal.jsx";
import { t } from "../i18n/index.js";
import { GAME_LABELS, inp, RULE_TIPS, SHOP_LABELS } from "./settings/domain/settingsConstants.js";
import { useDmSettings } from "./settings/useDmSettings.js";
import ProfilePresetsSection from "./settings/sections/ProfilePresetsSection.jsx";

export default function DMSettings() {
  const {
    joinEnabled,
    setJoinEnabled,
    joinCode,
    setJoinCode,
    showJoin,
    setShowJoin,
    newPass,
    setNewPass,
    newPass2,
    setNewPass2,
    showPass,
    setShowPass,
    msg,
    err,
    ticketRules,
    showOnlyChanged,
    setShowOnlyChanged,
    ticketBusy,
    ticketMsg,
    ticketErr,
    questConfirm,
    closeQuestConfirm,
    profilePresets,
    presetAccess,
    setPresetAccess,
    presetBusy,
    presetMsg,
    presetErr,
    readOnly,
    lanUrl,
    ticketDirty,
    generalChanges,
    showGeneralBlock,
    showGeneralInputs,
    showDailyQuestBlock,
    filteredGames,
    filteredShop,
    saveJoinCode,
    changePassword,
    updateTicketRules,
    addDailyQuest,
    updateDailyQuest,
    removeDailyQuest,
    setActiveDailyQuest,
    resetDailyQuestToday,
    reassignDailyQuestToday,
    confirmDailyQuestAction,
    updateTicketGame,
    updateTicketShop,
    saveTicketRules,
    resetTicketRules,
    addPreset,
    removePreset,
    updatePreset,
    updatePresetData,
    saveProfilePresets,
    exportZip,
    importZip
  } = useDmSettings();

  return (
    <div className="card taped">
      <div className="u-title-xl">Настройки</div>
      <div className="small">Код партии, безопасность, экономика, локальная сеть и брандмауэр.</div>
      <hr />
      {readOnly ? <div className="badge warn">Режим только чтения: изменения отключены</div> : null}
      {err && <div className="badge off">{"\u041e\u0448\u0438\u0431\u043a\u0430: "}{err}</div>}
      {msg && <div className="badge ok">{msg}</div>}

      <div className="list">
        <div className="title u-mt-6">{"\u0418\u0433\u0440\u043e\u043a"}</div>
        <div className="card taped">
          <div className="u-fw-800">Код партии (код входа)</div>
          <div className="small">{"\u0415\u0441\u043b\u0438 \u0432\u043a\u043b\u044e\u0447\u0435\u043d \u2014 \u0438\u0433\u0440\u043e\u043a\u0438 \u0432\u0432\u043e\u0434\u044f\u0442 \u043a\u043e\u0434 \u043f\u0440\u0438 \u0432\u0445\u043e\u0434\u0435."}</div>
          <hr />
          <label className="row">
            <input type="checkbox" checked={joinEnabled} onChange={(e) => setJoinEnabled(e.target.checked)} disabled={readOnly} />
            <span>{"\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u043a\u043e\u0434 \u043f\u0430\u0440\u0442\u0438\u0438"}</span>
          </label>
          <div className="row u-row-gap-8 u-mt-10">
            <input
              type={showJoin ? "text" : "password"}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder={"\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: 1234"}
              aria-label="Код партии"
              style={inp}
              disabled={!joinEnabled}
            />
            <button className="btn secondary" onClick={() => setShowJoin((v) => !v)} disabled={!joinEnabled}>
              {showJoin ? "\u0421\u043a\u0440\u044b\u0442\u044c" : "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c"}
            </button>
            <button className="btn" onClick={saveJoinCode} disabled={readOnly}>{"\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c"}</button>
          </div>
        </div>

        <ProfilePresetsSection
          presetErr={presetErr}
          presetMsg={presetMsg}
          presetAccess={presetAccess}
          setPresetAccess={setPresetAccess}
          addPreset={addPreset}
          saveProfilePresets={saveProfilePresets}
          readOnly={readOnly}
          presetBusy={presetBusy}
          profilePresets={profilePresets}
          removePreset={removePreset}
          updatePreset={updatePreset}
          updatePresetData={updatePresetData}
        />

        <div className="title u-mt-10">{"\u0414\u041c"}</div>
        <div className="card taped">
          <div className="u-fw-800">Смена пароля мастера</div>
          <div className="small">{"\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u0442\u0441\u044f \u0441\u043c\u0435\u043d\u0438\u0442\u044c \u043f\u0430\u0440\u043e\u043b\u044c \u043f\u043e\u0441\u043b\u0435 \u043f\u0435\u0440\u0432\u043e\u0433\u043e \u0437\u0430\u043f\u0443\u0441\u043a\u0430."}</div>
          <hr />
          <div className="row u-row-gap-8">
            <input
              type={showPass ? "text" : "password"}
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder={"\u041d\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c"}
              aria-label="Новый пароль DM"
              style={inp}
            />
            <input
              type={showPass ? "text" : "password"}
              value={newPass2}
              onChange={(e) => setNewPass2(e.target.value)}
              placeholder={"\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u043f\u0430\u0440\u043e\u043b\u044c"}
              aria-label="Повторите новый пароль DM"
              style={inp}
            />
            <button className="btn secondary" onClick={() => setShowPass((v) => !v)}>
              {showPass ? "\u0421\u043a\u0440\u044b\u0442\u044c" : "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c"}
            </button>
            <button className="btn" onClick={changePassword} disabled={readOnly}>{"\u0421\u043c\u0435\u043d\u0438\u0442\u044c"}</button>
          </div>
        </div>

        <div className="card taped">
          <div className="u-fw-800">Локальная сеть / Брандмауэр Windows</div>
          <div className="small">{"\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e\u0441\u0442\u044c \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u0441 \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u043e\u0432 \u0432 \u0442\u043e\u0439 \u0436\u0435 \u0441\u0435\u0442\u0438."}</div>
          <hr />
          <div className="paper-note u-mb-10">
            <div className="title">Локальная сеть</div>
            <div className="small">{"\u0423\u0431\u0435\u0434\u0438\u0442\u0435\u0441\u044c, \u0447\u0442\u043e \u0432\u0441\u0435 \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0430 \u0432 \u043e\u0434\u043d\u043e\u0439 Wi-Fi \u0441\u0435\u0442\u0438 \u0438 \u043e\u0442\u043a\u0440\u044b\u0432\u0430\u044e\u0442 IP \u0441\u0435\u0440\u0432\u0435\u0440\u0430."}</div>
          </div>
          <div className="small u-line-15">
            <b>{"\u0421\u0441\u044b\u043b\u043a\u0430 \u0434\u043b\u044f \u0438\u0433\u0440\u043e\u043a\u043e\u0432:"}</b> {lanUrl || "\u2014"}<br />
            <b>{"\u0415\u0441\u043b\u0438 \u043d\u0435 \u0437\u0430\u0445\u043e\u0434\u0438\u0442:"}</b>
            <ul className="u-mt-6">
              <li>{"\u0421\u0435\u0440\u0432\u0435\u0440 \u0434\u043e\u043b\u0436\u0435\u043d \u0441\u043b\u0443\u0448\u0430\u0442\u044c 0.0.0.0, \u0430 \u043d\u0435 \u0442\u043e\u043b\u044c\u043a\u043e localhost."}</li>
              <li>Разрешите доступ в брандмауэре для частных сетей.</li>
              <li>{"\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u043f\u043e\u0440\u0442 \u0438 \u0447\u0442\u043e \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0430 \u0432 \u043e\u0434\u043d\u043e\u0439 \u0441\u0435\u0442\u0438."}</li>
            </ul>
          </div>
        </div>

        <div className="card taped">
          <div className="u-fw-800">Резервная копия</div>
          <div className="small">{"\u042d\u043a\u0441\u043f\u043e\u0440\u0442/\u0438\u043c\u043f\u043e\u0440\u0442: app.db + uploads/ (zip)"}</div>
          <hr />
          <button className="btn secondary" onClick={exportZip}>{"\u042d\u043a\u0441\u043f\u043e\u0440\u0442 (zip)"}</button>
          <div className="u-mt-10">
            <input type="file" accept=".zip" onChange={importZip} aria-label="Импорт резервной копии zip" disabled={readOnly} />
          </div>
        </div>

        <div className="title u-mt-10">{"\u042d\u043a\u043e\u043d\u043e\u043c\u0438\u043a\u0430"}</div>
        <div className="card taped">
          <div className="u-fw-800">{"\u0410\u0440\u043a\u0430\u0434\u0430 \u0438 \u0431\u0438\u043b\u0435\u0442\u044b"}</div>
          <div className="small">{"\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430 \u0438\u0433\u0440, \u043b\u0438\u043c\u0438\u0442\u043e\u0432 \u0438 \u0446\u0435\u043d."}</div>
          <hr />
          <div className="row u-row-gap-8 u-row-wrap">
            <label className="row u-row-gap-6" title={RULE_TIPS.showOnlyChanged}>
              <input
                type="checkbox"
                checked={showOnlyChanged}
                onChange={(e) => setShowOnlyChanged(e.target.checked)}
              />
              <span>{"\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u0438\u0437\u043c\u0435\u043d\u0451\u043d\u043d\u044b\u0435"}</span>
            </label>
            {ticketDirty ? (
              <span className="badge warn">{"\u0415\u0441\u0442\u044c \u043d\u0435\u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0435 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f"}</span>
            ) : (
              <span className="badge ok">{"\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439 \u043d\u0435\u0442"}</span>
            )}
            <button className="btn" onClick={saveTicketRules} disabled={readOnly || ticketBusy || !ticketDirty}>
              {"\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c"}
            </button>
            <button className="btn secondary" onClick={resetTicketRules} disabled={readOnly || ticketBusy}>
              {"\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u043a \u0434\u0435\u0444\u043e\u043b\u0442\u0443"}
            </button>
          </div>
          {ticketErr ? <div className="badge off">{"\u041e\u0448\u0438\u0431\u043a\u0430: "}{ticketErr}</div> : null}
          {ticketMsg ? <div className="badge ok">{ticketMsg}</div> : null}
          {!ticketRules ? (
            <div className="badge warn">{"\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043a..."}</div>
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
                      <span>{"\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0430\u0440\u043a\u0430\u0434\u0443 \u0438 \u0431\u0438\u043b\u0435\u0442\u044b"}</span>
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
                          placeholder={"\u0414\u043d\u0435\u0432\u043d\u043e\u0439 \u043b\u0438\u043c\u0438\u0442"}
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
                          placeholder={"\u0421\u0435\u0440\u0438\u044f max"}
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
                          placeholder={"\u0421\u0435\u0440\u0438\u044f \u0448\u0430\u0433"}
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
                          placeholder={"\u0411\u043e\u043d\u0443\u0441 \u0441\u0435\u0440\u0438\u0438"}
                          aria-label="Фиксированный бонус серии"
                          title={RULE_TIPS.streakFlatBonus}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="badge warn">{"\u041d\u0435\u0442 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u043d\u044b\u0445 \u043e\u0431\u0449\u0438\u0445 \u043f\u0440\u0430\u0432\u0438\u043b."}</div>
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
                      <span>{"\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0435\u0436\u0435\u0434\u043d\u0435\u0432\u043d\u044b\u0439 \u043a\u0432\u0435\u0441\u0442"}</span>
                    </label>
                    <button className="btn secondary" onClick={addDailyQuest}>+ {"\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c"}</button>
                    <button className="btn secondary" onClick={resetDailyQuestToday} disabled={readOnly || ticketBusy}>
                      {"\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f"}
                    </button>
                    <button className="btn secondary" onClick={reassignDailyQuestToday} disabled={readOnly || ticketBusy}>
                      {"\u041f\u0435\u0440\u0435\u043d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c \u0441\u0435\u0433\u043e\u0434\u043d\u044f"}
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
                              <span>{"\u0412\u043a\u043b"}</span>
                            </label>
                            <button className="btn danger" onClick={() => removeDailyQuest(idx)}>{"\u0423\u0434\u0430\u043b\u0438\u0442\u044c"}</button>
                          </div>
                        </div>
                        <div className="settings-fields">
                          <input
                            value={q.title || ""}
                            onChange={(e) => updateDailyQuest(idx, { title: e.target.value })}
                            placeholder={"\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a"}
                            aria-label="Заголовок ежедневного квеста"
                            maxLength={80}
                            title={RULE_TIPS.dailyQuestTitle}
                          />
                          <input
                            value={q.description || ""}
                            onChange={(e) => updateDailyQuest(idx, { description: e.target.value })}
                            placeholder={"\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435"}
                            aria-label="Описание ежедневного квеста"
                            maxLength={160}
                            title={RULE_TIPS.dailyQuestDescription}
                          />
                          <input
                            type="number"
                            min="1"
                            value={q.goal ?? 2}
                            onChange={(e) => updateDailyQuest(idx, { goal: Number(e.target.value) || 1 })}
                            placeholder={"\u0426\u0435\u043b\u044c"}
                            aria-label="Цель ежедневного квеста"
                            title={RULE_TIPS.dailyQuestGoal}
                          />
                          <input
                            type="number"
                            min="0"
                            value={q.reward ?? 0}
                            onChange={(e) => updateDailyQuest(idx, { reward: Number(e.target.value) || 0 })}
                            placeholder={"\u041d\u0430\u0433\u0440\u0430\u0434\u0430"}
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
                <div className="title">{"\u0418\u0433\u0440\u044b"}</div>
                <div className="settings-grid u-mt-8">
                  {showOnlyChanged && filteredGames.length === 0 ? (
                    <div className="badge warn">{"\u041d\u0435\u0442 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u043d\u044b\u0445 \u043f\u0440\u0430\u0432\u0438\u043b \u0434\u043b\u044f \u0438\u0433\u0440."}</div>
                  ) : (
                    filteredGames.map(([key, g]) => (
                      <div key={key} className="item settings-card">
                        <div className="settings-head">
                          <div className="u-fw-800">{GAME_LABELS[key] || key}</div>
                          <label className="row u-row-gap-6" title={RULE_TIPS.gameEnabled}>
                            <input
                              type="checkbox"
                              checked={g.enabled !== false}
                              onChange={(e) => updateTicketGame(key, { enabled: e.target.checked })}
                            />
                            <span>{"\u0412\u043a\u043b"}</span>
                          </label>
                        </div>
                        <div className="settings-fields">
                          <input
                            type="number"
                            min="0"
                            value={g.entryCost ?? 0}
                            onChange={(e) => updateTicketGame(key, { entryCost: Number(e.target.value) || 0 })}
                            placeholder={"\u0412\u0445\u043e\u0434"}
                            aria-label={`Стоимость входа: ${GAME_LABELS[key] || key}`}
                            title={RULE_TIPS.entryCost}
                          />
                          <input
                            type="number"
                            min="0"
                            value={g.rewardMin ?? 0}
                            onChange={(e) => updateTicketGame(key, { rewardMin: Number(e.target.value) || 0 })}
                            placeholder={"\u041c\u0438\u043d"}
                            aria-label={`Минимальная награда: ${GAME_LABELS[key] || key}`}
                            title={RULE_TIPS.rewardMin}
                          />
                          <input
                            type="number"
                            min="0"
                            value={g.rewardMax ?? 0}
                            onChange={(e) => updateTicketGame(key, { rewardMax: Number(e.target.value) || 0 })}
                            placeholder={"\u041c\u0430\u043a\u0441"}
                            aria-label={`Максимальная награда: ${GAME_LABELS[key] || key}`}
                            title={RULE_TIPS.rewardMax}
                          />
                          <input
                            type="number"
                            min="0"
                            value={g.lossPenalty ?? 0}
                            onChange={(e) => updateTicketGame(key, { lossPenalty: Number(e.target.value) || 0 })}
                            placeholder={"\u0428\u0442\u0440\u0430\u0444"}
                            aria-label={`Штраф за поражение: ${GAME_LABELS[key] || key}`}
                            title={RULE_TIPS.lossPenalty}
                          />
                          <input
                            type="number"
                            min="0"
                            value={g.dailyLimit ?? 0}
                            onChange={(e) => updateTicketGame(key, { dailyLimit: Number(e.target.value) || 0 })}
                            placeholder={"\u041b\u0438\u043c\u0438\u0442/\u0434\u0435\u043d\u044c"}
                            aria-label={`Дневной лимит: ${GAME_LABELS[key] || key}`}
                            title={RULE_TIPS.dailyLimit}
                          />
                        </div>
                        <div className="settings-fields">
                          <input
                            value={g.ui?.difficulty ?? ""}
                            onChange={(e) => updateTicketGame(key, { ui: { difficulty: e.target.value } })}
                            placeholder={"\u0421\u043b\u043e\u0436\u043d\u043e\u0441\u0442\u044c"}
                            aria-label={`UI сложность: ${GAME_LABELS[key] || key}`}
                            maxLength={40}
                            title={RULE_TIPS.uiDifficulty}
                          />
                          <input
                            value={g.ui?.risk ?? ""}
                            onChange={(e) => updateTicketGame(key, { ui: { risk: e.target.value } })}
                            placeholder={"\u0420\u0438\u0441\u043a"}
                            aria-label={`UI риск: ${GAME_LABELS[key] || key}`}
                            maxLength={40}
                            title={RULE_TIPS.uiRisk}
                          />
                          <input
                            value={g.ui?.time ?? ""}
                            onChange={(e) => updateTicketGame(key, { ui: { time: e.target.value } })}
                            placeholder={"\u0412\u0440\u0435\u043c\u044f"}
                            aria-label={`UI время: ${GAME_LABELS[key] || key}`}
                            maxLength={40}
                            title={RULE_TIPS.uiTime}
                          />
                        </div>
                        <div className="settings-sub">{"\u041d\u0430\u0433\u0440\u0430\u0434\u0430 \u0438 \u0448\u0442\u0440\u0430\u0444\u044b \u0437\u0430\u0434\u0430\u044e\u0442 \u0434\u0438\u0430\u043f\u0430\u0437\u043e\u043d \u0431\u0438\u043b\u0435\u0442\u043e\u0432."}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="paper-note">
                <div className="title">{"\u0418\u043d\u0432\u0435\u043d\u0442\u0430\u0440\u044c (\u043c\u0430\u0433\u0430\u0437\u0438\u043d)"}</div>
                <div className="settings-grid u-mt-8">
                  {showOnlyChanged && filteredShop.length === 0 ? (
                    <div className="badge warn">{"\u041d\u0435\u0442 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u043d\u044b\u0445 \u043f\u0440\u0430\u0432\u0438\u043b \u0434\u043b\u044f \u043c\u0430\u0433\u0430\u0437\u0438\u043d\u0430."}</div>
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
                            <span>{"\u0412\u043a\u043b"}</span>
                          </label>
                        </div>
                        <div className="settings-fields">
                          <input
                            type="number"
                            min="0"
                            value={item.price ?? 0}
                            onChange={(e) => updateTicketShop(key, { price: Number(e.target.value) || 0 })}
                            placeholder={"\u0426\u0435\u043d\u0430"}
                            aria-label={`Цена товара: ${SHOP_LABELS[key] || key}`}
                            title={RULE_TIPS.shopPrice}
                          />
                          <input
                            type="number"
                            min="0"
                            value={item.dailyLimit ?? 0}
                            onChange={(e) => updateTicketShop(key, { dailyLimit: Number(e.target.value) || 0 })}
                            placeholder={"\u041b\u0438\u043c\u0438\u0442/\u0434\u0435\u043d\u044c"}
                            aria-label={`Дневной лимит товара: ${SHOP_LABELS[key] || key}`}
                            title={RULE_TIPS.shopDailyLimit}
                          />
                        </div>
                        <div className="settings-sub">{"\u041b\u0438\u043c\u0438\u0442 0 = \u0431\u0435\u0437 \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u044f."}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!questConfirm}
        title={questConfirm?.action === "reset" ? t("dmSettings.questResetTitle") : t("dmSettings.questReassignTitle")}
        message={questConfirm?.action === "reset" ? t("dmSettings.questResetBody") : t("dmSettings.questReassignBody")}
        onCancel={closeQuestConfirm}
        onConfirm={confirmDailyQuestAction}
        confirmDisabled={readOnly || ticketBusy}
      />
    </div>
  );
}

