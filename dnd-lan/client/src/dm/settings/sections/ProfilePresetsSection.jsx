import React from "react";
import { StatsEditor, StatsView } from "../../../components/profile/StatsEditor.jsx";
import PolaroidFrame from "../../../components/vintage/PolaroidFrame.jsx";
import { inp } from "../domain/settingsConstants.js";

export default function ProfilePresetsSection({
  presetErr,
  presetMsg,
  presetAccess,
  setPresetAccess,
  addPreset,
  saveProfilePresets,
  readOnly,
  presetBusy,
  profilePresets,
  removePreset,
  updatePreset,
  updatePresetData
}) {
  return (
    <div className="card taped">
      <div className="u-fw-800">{"Пресеты профиля"}</div>
      <div className="small">{"Шаблоны профиля для игроков."}</div>
      <hr />
      {presetErr ? <div className="badge off">{"Ошибка: "}{presetErr}</div> : null}
      {presetMsg ? <div className="badge ok">{presetMsg}</div> : null}
      <div className="list">
        <label className="row">
          <input
            type="checkbox"
            checked={presetAccess.enabled !== false}
            onChange={(e) => setPresetAccess({ ...presetAccess, enabled: e.target.checked })}
          />
          <span>{"Включить пресеты для игроков"}</span>
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={presetAccess.playerEdit !== false}
            onChange={(e) => setPresetAccess({ ...presetAccess, playerEdit: e.target.checked })}
          />
          <span>{"Разрешить применение в прямом редактировании"}</span>
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={presetAccess.playerRequest !== false}
            onChange={(e) => setPresetAccess({ ...presetAccess, playerRequest: e.target.checked })}
          />
          <span>{"Разрешить применение в запросах"}</span>
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={!!presetAccess.hideLocal}
            onChange={(e) => setPresetAccess({ ...presetAccess, hideLocal: e.target.checked })}
          />
          <span>Скрыть локальные пресеты (только мастер)</span>
        </label>

        <div className="row u-row-gap-8 u-row-wrap">
          <button className="btn secondary" onClick={addPreset} disabled={readOnly}>+ {"Добавить пресет"}</button>
          <button className="btn" onClick={saveProfilePresets} disabled={readOnly || presetBusy}>{"Сохранить"}</button>
        </div>

        {profilePresets.length === 0 ? (
          <div className="badge warn">{"Пресетов пока нет."}</div>
        ) : (
          <div className="list">
            {profilePresets.map((preset, idx) => (
              <div key={preset.id || `${preset.title}-${idx}`} className="paper-note">
                <div className="row u-row-between-center">
                  <div className="title">{"Пресет #"}{idx + 1}</div>
                  <button className="btn danger" onClick={() => removePreset(idx)} disabled={readOnly}>{"Удалить"}</button>
                </div>
                <div className="list u-mt-10">
                  <input
                    value={preset.title || ""}
                    onChange={(e) => updatePreset(idx, { title: e.target.value })}
                    placeholder={"Название пресета"}
                    aria-label="Название пресета профиля"
                    maxLength={80}
                    style={inp}
                  />
                  <input
                    value={preset.subtitle || ""}
                    onChange={(e) => updatePreset(idx, { subtitle: e.target.value })}
                    placeholder={"Подзаголовок / описание"}
                    aria-label="Подзаголовок пресета"
                    maxLength={160}
                    style={inp}
                  />
                  <div className="row u-row-gap-8 u-row-wrap">
                    <input
                      value={preset.data?.characterName || ""}
                      onChange={(e) => updatePresetData(idx, { characterName: e.target.value })}
                      placeholder={"Имя персонажа"}
                      aria-label="Имя персонажа в пресете"
                      maxLength={80}
                      style={inp}
                      className="u-minw-220"
                    />
                    <input
                      value={preset.data?.classRole || ""}
                      onChange={(e) => updatePresetData(idx, { classRole: e.target.value })}
                      placeholder={"Класс / роль"}
                      aria-label="Класс или роль в пресете"
                      maxLength={80}
                      style={inp}
                      className="u-minw-220"
                    />
                    <input
                      value={preset.data?.level ?? ""}
                      onChange={(e) => updatePresetData(idx, { level: e.target.value })}
                      placeholder={"Уровень"}
                      aria-label="Уровень в пресете"
                      style={inp}
                      className="u-minw-140"
                    />
                  </div>
                  <div className="kv">
                    <div className="title">{"Статы"}</div>
                    <StatsEditor value={preset.data?.stats || {}} onChange={(stats) => updatePresetData(idx, { stats })} readOnly={readOnly} />
                  </div>
                  <div className="paper-note u-mt-8">
                    <div className="title">{"Превью"}</div>
                    <div className="row u-items-start u-mt-10">
                      <PolaroidFrame
                        className="sm"
                        src={preset.data?.avatarUrl || ""}
                        alt={preset.data?.characterName || preset.title}
                        fallback={(preset.data?.characterName || preset.title || "?").slice(0, 1)}
                      />
                      <div className="u-minw-0">
                        <div className="u-fw-900">{preset.data?.characterName || "Без имени"}</div>
                        <div className="small u-mt-4">
                          {preset.data?.classRole || "Класс/роль"} • lvl {preset.data?.level || "?"}
                        </div>
                      </div>
                    </div>
                    <div className="u-mt-10">
                      <StatsView stats={preset.data?.stats || {}} />
                    </div>
                    <div className="small bio-text u-mt-10 u-pre-wrap">
                      {preset.data?.bio || "Биография не заполнена"}
                    </div>
                  </div>
                  <textarea
                    value={preset.data?.bio || ""}
                    onChange={(e) => updatePresetData(idx, { bio: e.target.value })}
                    rows={5}
                    maxLength={2000}
                    placeholder={"Биография"}
                    aria-label="Биография в пресете"
                    style={inp}
                  />
                  <input
                    value={preset.data?.avatarUrl || ""}
                    onChange={(e) => updatePresetData(idx, { avatarUrl: e.target.value })}
                    placeholder={"URL аватара"}
                    aria-label="URL аватара в пресете"
                    maxLength={512}
                    style={inp}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
