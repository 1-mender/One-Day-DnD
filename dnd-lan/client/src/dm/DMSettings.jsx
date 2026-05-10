import React from "react";
import ConfirmModal from "../components/ConfirmModal.jsx";
import { t } from "../i18n/index.js";
import { useDmSettings } from "./settings/useDmSettings.js";
import BackupSettingsSection from "./settings/sections/BackupSettingsSection.jsx";
import DMSettingsFold from "./settings/sections/DMSettingsFold.jsx";
import JoinSettingsSection from "./settings/sections/JoinSettingsSection.jsx";
import NetworkSettingsSection from "./settings/sections/NetworkSettingsSection.jsx";
import PasswordSettingsSection from "./settings/sections/PasswordSettingsSection.jsx";
import ProfilePresetsSection from "./settings/sections/ProfilePresetsSection.jsx";
import TicketRulesSection from "./settings/sections/TicketRulesSection.jsx";

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

  const joinSummary = joinEnabled ? "Код входа включён" : "Код входа выключен";
  const presetsEnabled = presetAccess?.enabled !== false;
  const presetSummary = `Пресетов: ${profilePresets.length} • ${presetsEnabled ? "доступны" : "выключены"}`;
  const passwordSummary = readOnly ? "Только просмотр" : "Сменить пароль мастера";
  const networkSummary = lanUrl ? "LAN URL готов" : "Ссылка не найдена";
  const backupSummary = readOnly ? "Только экспорт" : "Экспорт и импорт ZIP";
  const ticketSummary = ticketRules?.enabled === false ? "Аркада выключена" : "Аркада включена";

  return (
    <div className="card taped tf-shell tf-dm-settings-shell">
      <div className="tf-page-head">
        <div className="tf-page-head-main">
          <div className="tf-overline">Session controls</div>
          <div className="u-title-xl tf-page-title">Настройки</div>
          <div className="small">Код партии, безопасность, экономика, локальная сеть и брандмауэр.</div>
        </div>
      </div>
      <hr />
      {readOnly ? <div className="badge warn">Режим только чтения: изменения отключены</div> : null}
      {err && <div className="badge off">{"\u041e\u0448\u0438\u0431\u043a\u0430: "}{err}</div>}
      {msg && <div className="badge ok">{msg}</div>}

      <div className="list dm-settings-stack">
        <div className="title u-mt-6 dm-settings-group-title">{"\u0418\u0433\u0440\u043e\u043a"}</div>
        <DMSettingsFold
          title="Код партии"
          description="Быстрый доступ игрока при входе."
          summary={joinSummary}
          defaultOpen={true}
        >
          <JoinSettingsSection
            joinEnabled={joinEnabled}
            setJoinEnabled={setJoinEnabled}
            showJoin={showJoin}
            setShowJoin={setShowJoin}
            joinCode={joinCode}
            setJoinCode={setJoinCode}
            saveJoinCode={saveJoinCode}
            readOnly={readOnly}
          />
        </DMSettingsFold>

        <DMSettingsFold
          title="Пресеты профиля"
          description="Шаблоны для игроков и запросов."
          summary={presetSummary}
          defaultOpen={Boolean(presetErr)}
        >
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
        </DMSettingsFold>

        <div className="title u-mt-10 dm-settings-group-title">{"\u0414\u041c"}</div>
        <DMSettingsFold
          title="Пароль мастера"
          description="Безопасность доступа для DM."
          summary={passwordSummary}
        >
          <PasswordSettingsSection
            showPass={showPass}
            setShowPass={setShowPass}
            newPass={newPass}
            setNewPass={setNewPass}
            newPass2={newPass2}
            setNewPass2={setNewPass2}
            changePassword={changePassword}
            readOnly={readOnly}
          />
        </DMSettingsFold>

        <DMSettingsFold
          title="Локальная сеть"
          description="Проверка LAN URL и подсказки по доступу."
          summary={networkSummary}
        >
          <NetworkSettingsSection lanUrl={lanUrl} />
        </DMSettingsFold>

        <DMSettingsFold
          title="Резервная копия"
          description="Экспорт и импорт `app.db` вместе с `uploads`."
          summary={backupSummary}
        >
          <BackupSettingsSection exportZip={exportZip} importZip={importZip} readOnly={readOnly} />
        </DMSettingsFold>

        <div className="title u-mt-10 dm-settings-group-title">{"\u042d\u043a\u043e\u043d\u043e\u043c\u0438\u043a\u0430"}</div>
        <DMSettingsFold
          title="Аркада и билеты"
          description="Игры, лимиты, квесты и магазин."
          summary={ticketDirty ? "Есть несохранённые изменения" : ticketSummary}
          defaultOpen={Boolean(ticketErr || ticketDirty)}
        >
          <TicketRulesSection
            showOnlyChanged={showOnlyChanged}
            setShowOnlyChanged={setShowOnlyChanged}
            ticketDirty={ticketDirty}
            saveTicketRules={saveTicketRules}
            resetTicketRules={resetTicketRules}
            readOnly={readOnly}
            ticketBusy={ticketBusy}
            ticketErr={ticketErr}
            ticketMsg={ticketMsg}
            ticketRules={ticketRules}
            showGeneralBlock={showGeneralBlock}
            generalChanges={generalChanges}
            showGeneralInputs={showGeneralInputs}
            updateTicketRules={updateTicketRules}
            showDailyQuestBlock={showDailyQuestBlock}
            addDailyQuest={addDailyQuest}
            resetDailyQuestToday={resetDailyQuestToday}
            reassignDailyQuestToday={reassignDailyQuestToday}
            setActiveDailyQuest={setActiveDailyQuest}
            updateDailyQuest={updateDailyQuest}
            removeDailyQuest={removeDailyQuest}
            filteredGames={filteredGames}
            updateTicketGame={updateTicketGame}
            filteredShop={filteredShop}
            updateTicketShop={updateTicketShop}
          />
        </DMSettingsFold>
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

