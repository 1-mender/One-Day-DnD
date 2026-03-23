import { ImageUp, Save } from "lucide-react";
import { StatsEditor, StatsView } from "../../../components/profile/StatsEditor.jsx";
import { EmptyState } from "../../../foundation/primitives/index.js";
import PolaroidFrame from "../../../components/vintage/PolaroidFrame.jsx";
import {
  DM_PROFILE_EDITABLE_OPTIONS,
  DM_STAT_PRESETS
} from "../playerProfileAdminDomain.js";
import {
  RACE_OPTIONS,
  getRaceValue,
  setRaceInStats
} from "../../../player/profileDomain.js";

const INPUT_STYLE = { width: "100%" };

export default function DMPlayerProfileProfileTab({ controller }) {
  const {
    applyPreset,
    applyProfilePreset,
    canSave,
    fileInputRef,
    form,
    handleAvatarFileChange,
    notCreated,
    profilePresets,
    readOnly,
    resetForm,
    save,
    setForm,
    toggleEditable,
    uploading
  } = controller;

  return (
    <>
      {notCreated ? (
        <EmptyState title="Профиль не создан" hint="Заполните поля и нажмите «Сохранить»." />
      ) : null}
      <div className="spread-grid u-mt-10">
        <div className="paper-note">
          <div className="title">Данные персонажа</div>
          {profilePresets.length ? (
            <div className="preset-panel u-mt-8">
              <div className="row u-row-between-baseline">
                <div className="small">Глобальные пресеты</div>
                <div className="small note-hint">Применяет имя, класс, уровень, статы и био.</div>
              </div>
              <div className="preset-grid">
                {profilePresets.map((preset) => (
                  <button
                    key={preset.id || preset.title}
                    type="button"
                    className="preset-card"
                    onClick={() => applyProfilePreset(preset)}
                    disabled={readOnly}
                  >
                    <div className="preset-title">{preset.title}</div>
                    <div className="small">{preset.subtitle}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="list u-mt-10">
            <input
              value={form.characterName}
              onChange={(event) => setForm({ ...form, characterName: event.target.value })}
              placeholder="Имя персонажа"
              aria-label="Имя персонажа"
              maxLength={80}
              disabled={readOnly}
              style={INPUT_STYLE}
            />
            <input
              value={form.classRole}
              onChange={(event) => setForm({ ...form, classRole: event.target.value })}
              placeholder="Класс / роль"
              aria-label="Класс или роль"
              maxLength={80}
              disabled={readOnly}
              style={INPUT_STYLE}
            />
            <input
              value={form.level}
              onChange={(event) => setForm({ ...form, level: event.target.value })}
              placeholder="Уровень"
              aria-label="Уровень"
              disabled={readOnly}
              style={INPUT_STYLE}
            />
            <input
              value={form.avatarUrl}
              onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })}
              placeholder="URL аватара"
              aria-label="URL аватара"
              maxLength={512}
              disabled={readOnly}
              style={INPUT_STYLE}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFileChange}
              aria-label="Загрузка аватара"
              disabled={readOnly}
              className="u-hidden-input"
            />
            <button className="btn secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading || readOnly}>
              <ImageUp className="icon" aria-hidden="true" />{uploading ? "Загрузка..." : "Загрузить аватар"}
            </button>
            <div className="small note-hint">Можно вставить URL или загрузить файл (до 10MB).</div>
            <div className="kv">
              <div className="title"><span className="section-icon stat" aria-hidden="true" />Статы</div>
              <div className="row u-row-wrap">
                {DM_STAT_PRESETS.map((preset) => (
                  <button key={preset.key} className="btn secondary" onClick={() => applyPreset(preset)} disabled={readOnly}>
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="small note-hint">Пресет перезапишет текущие статы.</div>
              <select
                value={getRaceValue(form.stats)}
                onChange={(event) => setForm({ ...form, stats: setRaceInStats(form.stats, event.target.value) })}
                aria-label="Раса"
                disabled={readOnly}
                style={INPUT_STYLE}
              >
                {RACE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <StatsEditor value={form.stats} onChange={(stats) => setForm({ ...form, stats })} readOnly={readOnly} />
            </div>
            <div className="kv">
              <div className="title"><span className="section-icon bio" aria-hidden="true" />Биография</div>
              <textarea
                value={form.bio}
                onChange={(event) => setForm({ ...form, bio: event.target.value })}
                rows={6}
                maxLength={2000}
                placeholder="Биография (до 2000 символов)"
                aria-label="Биография"
                disabled={readOnly}
                style={INPUT_STYLE}
              />
              <div className="small">{String(form.bio || "").length}/2000</div>
            </div>
          </div>
        </div>

        <div className="list">
          <div className="paper-note">
            <div className="title">Превью</div>
            <div className="row u-items-start u-mt-10">
              <PolaroidFrame className="lg" src={form.avatarUrl} alt={form.characterName} fallback={(form.characterName || "?").slice(0, 1)} />
              <div>
                <div className="u-title-18">{form.characterName || "Без имени"}</div>
                <div className="small u-mt-6">
                  {form.classRole || "Класс/роль"} • lvl {form.level || "?"}
                </div>
              </div>
            </div>
            <div className="u-mt-12">
              <StatsView stats={form.stats} />
            </div>
            <div className="small bio-text u-mt-12 u-pre-wrap">
              {form.bio || "Биография не заполнена"}
            </div>
          </div>

          <div className="paper-note">
            <div className="title">Права игрока</div>
            <div className="list u-mt-10">
              {DM_PROFILE_EDITABLE_OPTIONS.map((option) => (
                <label key={option.key} className="row">
                  <input
                    type="checkbox"
                    checked={(form.editableFields || []).includes(option.key)}
                    onChange={() => toggleEditable(option.key)}
                    disabled={readOnly}
                    className="u-check-18"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
              <label className="row">
                <input
                  type="checkbox"
                  checked={!!form.allowRequests}
                  onChange={() => setForm({ ...form, allowRequests: !form.allowRequests })}
                  disabled={readOnly}
                  className="u-check-18"
                />
                <span>Разрешить запросы на изменение</span>
              </label>
            </div>
            <div className="small note-hint u-mt-6">
              Игрок сможет менять только отмеченные поля. Запросы это альтернатива для остальных правок.
            </div>
            <div className="row u-mt-12 u-row-gap-8">
              <button className="btn secondary" onClick={resetForm} disabled={readOnly}>Сбросить</button>
              <button className="btn" onClick={save} disabled={!canSave}>
                <Save className="icon" aria-hidden="true" />Сохранить
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
