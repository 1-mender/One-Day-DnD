import { useState } from "react";
import { ImageUp, Save } from "lucide-react";
import { StatsEditor, StatsView } from "../../../components/profile/StatsEditor.jsx";
import { EmptyState } from "../../../foundation/primitives/index.js";
import PolaroidFrame from "../../../components/vintage/PolaroidFrame.jsx";
import {
  DM_PROFILE_EDITABLE_OPTIONS,
  DM_PROFILE_PUBLIC_OPTIONS,
  DM_STAT_PRESETS,
  formatReputationLabel,
  getReputationTier,
  normalizeXp,
  normalizeReputation
} from "../playerProfileAdminDomain.js";
import {
  RACE_OPTIONS,
  getRaceValue,
  setRaceInStats
} from "../../../player/profileDomain.js";
import {
  CLASS_CATALOG,
  SPECIALIZATION_XP_THRESHOLD,
  getClassByKey,
  getClassPathLabel,
  getSpecializationByKey
} from "../../../player/classCatalog.js";

const INPUT_STYLE = { width: "100%" };

export default function DMPlayerProfileProfileTab({ controller }) {
  const {
    applyPreset,
    applyProfilePreset,
    awardXp,
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
    togglePublicField,
    uploading,
    xpAwarding
  } = controller;
  const [xpAwardAmount, setXpAwardAmount] = useState(10);
  const [xpAwardReason, setXpAwardReason] = useState("Рольплей");
  const reputationTier = getReputationTier(form.reputation);
  const selectedClass = getClassByKey(form.classKey);
  const selectedSpecialization = getSpecializationByKey(form.classKey, form.specializationKey);
  const classPathLabel = getClassPathLabel(form);
  const publicMetaPreview = [
    (form.publicFields || []).includes("classPath") && form.classKey ? classPathLabel : "",
    (form.publicFields || []).includes("classRole") ? form.classRole : "",
    (form.publicFields || []).includes("level") && form.level ? `lvl ${form.level}` : "",
    (form.publicFields || []).includes("reputation") ? `реп. ${formatReputationLabel(form.reputation)}` : ""
  ].filter(Boolean).join(" • ");
  const setReputation = (value) => setForm({ ...form, reputation: normalizeReputation(value) });
  const adjustReputation = (delta) => setReputation(Number(form.reputation || 0) + delta);
  const setClassKey = (classKey) => setForm({ ...form, classKey, specializationKey: "" });
  const setSpecializationKey = (specializationKey) => setForm({ ...form, specializationKey });
  const setXp = (value) => setForm({ ...form, xp: normalizeXp(value) });
  const adjustXp = (delta) => setXp(Number(form.xp || 0) + delta);
  const submitXpAward = () => {
    awardXp?.({ amount: xpAwardAmount, reason: xpAwardReason });
  };

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
            <label className="list">
              <span className="small note-hint">Репутация: от -100 до 100</span>
              <input
                type="number"
                min="-100"
                max="100"
                value={form.reputation}
                onChange={(event) => setForm({ ...form, reputation: event.target.value })}
                placeholder="Репутация"
                aria-label="Репутация"
                disabled={readOnly}
                style={INPUT_STYLE}
              />
              <div className="row u-row-gap-8 u-row-wrap">
                <span className={`badge ${reputationTier.tone}`}>{formatReputationLabel(form.reputation)}</span>
                <button type="button" className="btn secondary" onClick={() => adjustReputation(-10)} disabled={readOnly}>-10</button>
                <button type="button" className="btn secondary" onClick={() => setReputation(0)} disabled={readOnly}>Сброс</button>
                <button type="button" className="btn secondary" onClick={() => adjustReputation(10)} disabled={readOnly}>+10</button>
              </div>
            </label>
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
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
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
              <div className="title">Путь класса</div>
              <div className="small note-hint">
                Игрок выбирает класс сам, но DM управляет опытом и может вручную поправить путь.
              </div>
              <select
                value={form.classKey || ""}
                onChange={(event) => setClassKey(event.target.value)}
                aria-label="Базовый класс"
                disabled={readOnly}
                style={INPUT_STYLE}
              >
                <option value="">Класс не выбран</option>
                {CLASS_CATALOG.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
              <select
                value={form.specializationKey || ""}
                onChange={(event) => setSpecializationKey(event.target.value)}
                aria-label="Специализация"
                disabled={readOnly || !selectedClass}
                style={INPUT_STYLE}
              >
                <option value="">Специализация не выбрана</option>
                {(selectedClass?.specializations || []).map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
              <div className="row u-row-gap-8 u-row-wrap">
                <span className={`badge ${Number(form.xp || 0) >= SPECIALIZATION_XP_THRESHOLD ? "ok" : "secondary"}`}>
                  {normalizeXp(form.xp)} / {SPECIALIZATION_XP_THRESHOLD} XP
                </span>
                <span className="small note-hint">Основной способ изменения опыта: “Выдать XP” ниже.</span>
              </div>
              <div className="paper-note u-mt-8">
                <div className="small note-hint">Текущий путь</div>
                <div className="u-title-18">{classPathLabel || "Не выбран"}</div>
                <div className="small u-mt-6">
                  {selectedSpecialization?.description || selectedClass?.description || "Сначала выбери базовый класс."}
                </div>
              </div>
              <div className="paper-note u-mt-8">
                <div className="title">Выдать XP</div>
                <div className="small note-hint u-mt-6">
                  Это сразу сохранит опыт и добавит запись в историю игрока.
                </div>
                <div className="row u-row-gap-8 u-row-wrap u-mt-8">
                  {[5, 10, 15, 25].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className={`btn secondary ${Number(xpAwardAmount) === amount ? "active" : ""}`}
                      onClick={() => setXpAwardAmount(amount)}
                      disabled={readOnly || xpAwarding}
                    >
                      +{amount}
                    </button>
                  ))}
                </div>
                <div className="list u-mt-8">
                  <input
                    type="number"
                    min="-1000"
                    max="1000"
                    value={xpAwardAmount}
                    onChange={(event) => setXpAwardAmount(event.target.value)}
                    aria-label="Сколько XP выдать"
                    disabled={readOnly || xpAwarding}
                    style={INPUT_STYLE}
                  />
                  <select
                    value={xpAwardReason}
                    onChange={(event) => setXpAwardReason(event.target.value)}
                    aria-label="Причина XP"
                    disabled={readOnly || xpAwarding}
                    style={INPUT_STYLE}
                  >
                    <option value="Рольплей">Рольплей</option>
                    <option value="Бой">Бой</option>
                    <option value="Квест">Квест</option>
                    <option value="Важная сцена">Важная сцена</option>
                    <option value="Коррекция DM">Коррекция DM</option>
                  </select>
                  <button
                    type="button"
                    className="btn"
                    onClick={submitXpAward}
                    disabled={readOnly || xpAwarding}
                  >
                    {xpAwarding ? "Записываю..." : "Записать XP"}
                  </button>
                </div>
              </div>
              <details className="profile-collapse u-mt-8">
                <summary>
                  <span>Расширенно: ручная коррекция XP</span>
                  <span className="badge secondary">осторожно</span>
                </summary>
                <div className="profile-collapse-body">
                  <div className="small note-hint">
                    Используй только для исправления ошибок. Обычные начисления лучше делать через “Выдать XP”, чтобы сохранялась история.
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={form.xp}
                    onChange={(event) => setForm({ ...form, xp: event.target.value })}
                    placeholder="Опыт"
                    aria-label="Опыт класса"
                    disabled={readOnly}
                    style={INPUT_STYLE}
                  />
                  <div className="row u-row-gap-8 u-row-wrap">
                    <button type="button" className="btn secondary" onClick={() => adjustXp(-10)} disabled={readOnly}>-10</button>
                    <button type="button" className="btn secondary" onClick={() => setXp(0)} disabled={readOnly}>0</button>
                    <button type="button" className="btn secondary" onClick={() => adjustXp(10)} disabled={readOnly}>+10</button>
                    <button type="button" className="btn secondary" onClick={() => adjustXp(25)} disabled={readOnly}>+25</button>
                  </div>
                </div>
              </details>
              {form.xpLog?.length ? (
                <div className="paper-note u-mt-8">
                  <div className="title">История XP</div>
                  <div className="list u-mt-8">
                    {form.xpLog.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="row u-row-between-baseline u-row-gap-8">
                        <span className={`badge ${entry.amount > 0 ? "ok" : "off"}`}>{formatXpAmount(entry.amount)}</span>
                        <span className="small">{entry.reason || "Без причины"}</span>
                        <span className="small">{formatXpDate(entry.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
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
                  {classPathLabel || form.classRole || "Класс/роль"} • lvl {form.level || "?"} • реп. {formatReputationLabel(form.reputation)}
                </div>
                {form.classRole ? <div className="small u-mt-6">Роль: {form.classRole}</div> : null}
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
            <div className="title">Публичная карточка</div>
            <div className="small note-hint u-mt-6">
              Имя персонажа и аватар видны на карточке всегда. Остальные поля можно открыть отдельно.
            </div>
            <div className="list u-mt-10">
              {DM_PROFILE_PUBLIC_OPTIONS.map((option) => (
                <label key={option.key} className="row">
                  <input
                    type="checkbox"
                    checked={(form.publicFields || []).includes(option.key)}
                    onChange={() => togglePublicField(option.key)}
                    disabled={readOnly}
                    className="u-check-18"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
              <textarea
                value={form.publicBlurb}
                onChange={(event) => setForm({ ...form, publicBlurb: event.target.value })}
                rows={4}
                maxLength={280}
                placeholder="Короткое публичное описание для других игроков"
                aria-label="Публичное описание"
                disabled={readOnly}
                style={INPUT_STYLE}
              />
              <div className="small">{String(form.publicBlurb || "").length}/280</div>
            </div>
            <div className="paper-note u-mt-10">
              <div className="title">Превью карточки</div>
              <div className="u-title-18 u-mt-8">{form.characterName || "Без имени"}</div>
              <div className="small u-mt-6">
                {publicMetaPreview || "Только имя и аватар"}
              </div>
              {(form.publicFields || []).includes("race") ? (
                <div className="small u-mt-6">Раса: {getRaceValue(form.stats) || "human"}</div>
              ) : null}
              {(form.publicFields || []).includes("publicBlurb") && form.publicBlurb ? (
                <div className="small bio-text u-mt-8 u-pre-wrap">{form.publicBlurb}</div>
              ) : null}
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

function formatXpAmount(value) {
  const amount = Number(value || 0);
  return amount > 0 ? `+${amount}` : String(amount);
}

function formatXpDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString([], {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}
