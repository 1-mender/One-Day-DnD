import { useState } from "react";
import { ImageUp, Save } from "lucide-react";
import { StatsEditor, StatsView } from "../../../components/profile/StatsEditor.jsx";
import { EmptyState } from "../../../foundation/primitives/index.js";
import PolaroidFrame from "../../../components/vintage/PolaroidFrame.jsx";
import RaceFields from "../../../player/profile/sections/RaceFields.jsx";
import {
  DM_PROFILE_ACCESS_PRESETS,
  applyDmProfileTemplate,
  detectDmProfileTemplate,
  DM_PROFILE_EDITABLE_OPTIONS,
  DM_PROFILE_PUBLIC_OPTIONS,
  DM_PROFILE_STAT_LABELS,
  DM_PROFILE_TEMPLATES,
  DM_STAT_PRESETS,
  formatReputationLabel,
  getDmProfileTemplate,
  getReputationTier,
  normalizeXp,
  normalizeReputation
} from "../playerProfileAdminDomain.js";
import { getRaceProfile } from "../../../player/profileDomain.js";
import {
  CLASS_CATALOG,
  SPECIALIZATION_ROLE_LABELS,
  SPECIALIZATION_XP_THRESHOLD,
  getClassByKey,
  getClassPathLabel,
  getClassPathLabelWithRole,
  getSpecializationByKey,
  getSpecializationRole,
  getSpecializationTags
} from "../../../player/classCatalog.js";

const INPUT_STYLE = { width: "100%" };

export default function DMPlayerProfileProfileTab({ controller }) {
  const {
    assignSpecialization,
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
    xpAwarding,
    specializationSavingKey
  } = controller;
  const [xpAwardAmount, setXpAwardAmount] = useState(10);
  const [xpAwardReason, setXpAwardReason] = useState("Рольплей");
  const reputationTier = getReputationTier(form.reputation);
  const selectedClass = getClassByKey(form.classKey);
  const selectedSpecialization = getSpecializationByKey(form.classKey, form.specializationKey);
  const selectedSpecializationRole = getSpecializationRole(form);
  const selectedSpecializationTags = getSpecializationTags(form);
  const classPathLabel = getClassPathLabel(form);
  const raceProfile = getRaceProfile(form.stats);
  const classXp = normalizeXp(form.xp);
  const specializationReady = !!selectedClass && !selectedSpecialization && classXp >= SPECIALIZATION_XP_THRESHOLD;
  const specializationProgress = Math.min(100, Math.round((classXp / SPECIALIZATION_XP_THRESHOLD) * 100));
  const currentTemplateKey = detectDmProfileTemplate(form);
  const currentTemplate = getDmProfileTemplate(currentTemplateKey);
  const publicMetaPreview = [
    (form.publicFields || []).includes("classPath") && form.classKey ? getClassPathLabelWithRole(form) : "",
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
  const applyTemplate = (templateKey) => {
    setForm((current) => applyDmProfileTemplate(current, templateKey));
  };
  const applyAccessPreset = (preset) => {
    setForm((current) => ({
      ...current,
      publicFields: [...(preset.publicFields || [])],
      editableFields: [...(preset.editableFields || [])],
      allowRequests: !!preset.allowRequests
    }));
  };
  const isAccessPresetActive = (preset) => {
    const publicFields = [...(form.publicFields || [])].sort().join("|");
    const editableFields = [...(form.editableFields || [])].sort().join("|");
    return publicFields === [...(preset.publicFields || [])].sort().join("|")
      && editableFields === [...(preset.editableFields || [])].sort().join("|")
      && !!form.allowRequests === !!preset.allowRequests;
  };

  return (
    <>
      {notCreated ? (
        <EmptyState title="Профиль не создан" hint="Заполните поля и нажмите «Сохранить»." />
      ) : null}
      <div className="spread-grid u-mt-10">
        <div className="paper-note">
          <div className="title">Базовый профиль</div>
          <div className="small note-hint u-mt-4">
            Сначала выбери формат партии, затем заполняй роль, атрибуты и свободные поля. Fantasy-инструменты вынесены ниже отдельно.
          </div>

          {profilePresets.length ? (
            <div className="preset-panel u-mt-10">
              <div className="row u-row-between-baseline">
                <div className="small">Глобальные пресеты</div>
                <div className="small note-hint">Применяют имя, роль, уровень, статы и био.</div>
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

          <div className="preset-panel u-mt-10">
            <div className="row u-row-between-baseline">
              <div className="small">Шаблон сеттинга</div>
              <div className="small note-hint">Переключает базовые атрибуты и убирает лишнюю fantasy-привязку.</div>
            </div>
            <div className="preset-grid">
              {DM_PROFILE_TEMPLATES.map((template) => (
                <button
                  key={template.key}
                  type="button"
                  className={`preset-card${currentTemplateKey === template.key ? " is-active" : ""}`}
                  onClick={() => applyTemplate(template.key)}
                  disabled={readOnly}
                >
                  <div className="preset-title">{template.label}</div>
                  <div className="small">{template.summary}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="dm-profile-identity-grid u-mt-10">
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
              placeholder="Роль / архетип / профессия"
              aria-label="Роль или архетип"
              maxLength={80}
              disabled={readOnly}
              style={INPUT_STYLE}
            />
            <input
              value={form.level}
              onChange={(event) => setForm({ ...form, level: event.target.value })}
              placeholder="Уровень / ранг"
              aria-label="Уровень или ранг"
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
            <div className="dm-profile-avatar-tools">
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
              <div className="small note-hint">Можно вставить URL или загрузить файл до 10MB.</div>
            </div>
          </div>

          <div className="kv u-mt-12">
            <div className="title"><span className="section-icon stat" aria-hidden="true" />Атрибуты и свободные поля</div>
            <div className="small note-hint">
              Шаблон <b>{currentTemplate.label}</b>. Для любого сеттинга можно добавлять свои поля: фракция, мир, позывной, долг, лицензия и т.п.
            </div>
            {currentTemplateKey === "fantasy" ? (
              <div className="row u-row-wrap u-mt-8">
                {DM_STAT_PRESETS.map((preset) => (
                  <button key={preset.key} className="btn secondary" onClick={() => applyPreset(preset)} disabled={readOnly}>
                    {preset.label}
                  </button>
                ))}
              </div>
            ) : null}
            {currentTemplateKey === "fantasy" ? (
              <div className="small note-hint">Числовые наборы ниже удобны для классических fantasy-листов. В других режимах оставлены только свободные атрибуты.</div>
            ) : null}
            <StatsEditor
              value={form.stats}
              onChange={(stats) => setForm({ ...form, stats })}
              readOnly={readOnly}
              defaultKeys={currentTemplate.statKeys}
              keyLabels={DM_PROFILE_STAT_LABELS}
              addLabel="+ Добавить поле"
            />
          </div>

          <div className="kv u-mt-12">
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

          <details className="profile-collapse u-mt-12">
            <summary>
              <span>Fantasy-модуль: класс, специализация, XP и происхождение</span>
              <span className="badge secondary">{form.classKey || form.stats?.race ? "включён" : "опционально"}</span>
            </summary>
            <div className="profile-collapse-body">
              <div className="small note-hint">
                Используй этот блок для классического fantasy-профиля. Для модерна и sci-fi его можно оставить пустым.
              </div>

              <div className="kv">
                <div className="title">Путь класса</div>
                <div className="small note-hint">
                  Игрок может идти по классовой ветке, но DM полностью контролирует XP и при необходимости вручную меняет путь.
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
                <div id="dm-specialization-panel" className="paper-note profile-class-path-card u-mt-8">
                  <div className="row u-row-between-baseline u-row-gap-8 u-row-wrap">
                    <div>
                      <div className="small note-hint">Текущий путь</div>
                      <div className="u-title-18">{classPathLabel || "Не выбран"}</div>
                    </div>
                    <span className={`badge ${selectedSpecialization ? "ok" : specializationReady ? "warn" : "secondary"}`}>
                      {selectedSpecialization ? "ветка выбрана" : specializationReady ? "готов к выбору" : `${classXp}/${SPECIALIZATION_XP_THRESHOLD} XP`}
                    </span>
                  </div>
                  <div className="small">
                    {selectedSpecialization?.description || selectedClass?.description || "Сначала выбери базовый класс."}
                  </div>
                  <div className="profile-xp-track" aria-label={`Опыт специализации: ${classXp} из ${SPECIALIZATION_XP_THRESHOLD}`}>
                    <span style={{ width: `${specializationProgress}%` }} />
                  </div>
                  {selectedSpecialization ? (
                    <div className="profile-specialization-picked">
                      <span className="badge ok">Назначено</span>
                      <b>{selectedSpecialization.label}</b>
                      <RoleTagStrip role={selectedSpecializationRole} tags={selectedSpecializationTags} />
                      <small>{selectedSpecialization.description}</small>
                    </div>
                  ) : selectedClass && specializationReady ? (
                    <div className="list">
                      <div className="row u-row-between-baseline u-row-gap-8 u-row-wrap">
                        <div className="title">Выбери специализацию</div>
                        <span className="small note-hint">Нажатие сразу сохранит выбор.</span>
                      </div>
                      <div className="profile-specialization-grid">
                        {selectedClass.specializations.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            className="profile-class-option profile-specialization-option"
                            onClick={() => assignSpecialization?.(item.key)}
                            disabled={readOnly || !!specializationSavingKey}
                          >
                            <span>{item.label}</span>
                            <RoleTagStrip role={item.role ? { label: SPECIALIZATION_ROLE_LABELS[item.role] || item.role } : null} tags={item.tags} compact />
                            <small>{item.description}</small>
                            <small className="badge warn">
                              {specializationSavingKey === item.key ? "Сохраняю..." : "Назначить"}
                            </small>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : selectedClass ? (
                    <div className="profile-specialization-locked">
                      <span className="badge secondary">Специализация закрыта</span>
                      <small>
                        Нужно {SPECIALIZATION_XP_THRESHOLD} XP. Не хватает {Math.max(0, SPECIALIZATION_XP_THRESHOLD - classXp)} XP.
                      </small>
                    </div>
                  ) : null}
                  <div className="small note-hint">Основной способ изменения опыта: “Выдать XP” ниже.</div>
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

                <details className="profile-collapse u-mt-8">
                  <summary>
                    <span>Расширенно: ручной выбор специализации</span>
                    <span className="badge secondary">override</span>
                  </summary>
                  <div className="profile-collapse-body">
                    <div className="small note-hint">
                      Используй для исправлений или отката. Обычный сценарий: накопить XP и назначить ветку выше.
                    </div>
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
                  </div>
                </details>

                {form.xpLog?.length ? (
                  <div className="profile-xp-log u-mt-8">
                    <div className="title">История XP</div>
                    <div className="profile-xp-log-list">
                      {form.xpLog.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="profile-xp-log-row">
                          <span className={`badge ${entry.amount > 0 ? "ok" : "off"}`}>{formatXpAmount(entry.amount)}</span>
                          <span>{entry.reason || "Без причины"}</span>
                          <small>{formatXpDate(entry.createdAt)}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="kv">
                <div className="title">Происхождение / вид</div>
                <div className="small note-hint">
                  Поле остаётся опциональным. Если партия не использует fantasy-расы, оставь блок пустым и работай через свободные атрибуты выше.
                </div>
                <RaceFields
                  stats={form.stats}
                  onChange={(stats) => setForm({ ...form, stats })}
                  disabled={readOnly}
                />
              </div>
            </div>
          </details>
        </div>

        <div className="list">
          <div className="paper-note">
            <div className="title">Превью</div>
            <div className="small note-hint u-mt-4">Текущий шаблон: {currentTemplate.label}</div>
            <div className="row u-items-start u-mt-10">
              <PolaroidFrame className="lg" src={form.avatarUrl} alt={form.characterName} fallback={(form.characterName || "?").slice(0, 1)} />
              <div>
                <div className="u-title-18">{form.characterName || "Без имени"}</div>
                <div className="small u-mt-6">
                  {classPathLabel || form.classRole || "Роль / архетип"} • lvl {form.level || "?"} • реп. {formatReputationLabel(form.reputation)}
                </div>
                {form.classRole ? <div className="small u-mt-6">Роль: {form.classRole}</div> : null}
              </div>
            </div>
            <div className="u-mt-12">
              <StatsView stats={form.stats} keyLabels={DM_PROFILE_STAT_LABELS} />
            </div>
            <div className="small bio-text u-mt-12 u-pre-wrap">
              {form.bio || "Биография не заполнена"}
            </div>
          </div>

          <div className="paper-note">
            <div className="title">Публичная карточка</div>
            <div className="small note-hint u-mt-6">
              Имя персонажа и аватар видны всегда. Остальные поля мастер открывает отдельно.
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
                <div className="small u-mt-6">Происхождение / вид: {raceProfile.displayName}</div>
              ) : null}
              {(form.publicFields || []).includes("publicBlurb") && form.publicBlurb ? (
                <div className="small bio-text u-mt-8 u-pre-wrap">{form.publicBlurb}</div>
              ) : null}
            </div>
          </div>

          <div className="paper-note">
            <div className="title">Права игрока</div>
            <div className="preset-panel u-mt-10">
              <div className="row u-row-between-baseline">
                <div className="small">Быстрые режимы</div>
                <div className="small note-hint">Мгновенно переключают видимость и редактирование.</div>
              </div>
              <div className="preset-grid">
                {DM_PROFILE_ACCESS_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className={`preset-card${isAccessPresetActive(preset) ? " is-active" : ""}`}
                    onClick={() => applyAccessPreset(preset)}
                    disabled={readOnly}
                  >
                    <div className="preset-title">{preset.label}</div>
                    <div className="small">{preset.summary}</div>
                  </button>
                ))}
              </div>
            </div>
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
              Игрок сможет менять только отмеченные поля. Сейчас открыто: {(form.editableFields || []).length || 0} для редактирования и {(form.publicFields || []).length || 0} для публичной карточки.
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

function RoleTagStrip({ role, tags = [], compact = false }) {
  if (!role && !tags?.length) return null;
  return (
    <div className={`profile-role-strip${compact ? " compact" : ""}`}>
      {role ? <span className="badge ok profile-role-chip">{role.label}</span> : null}
      {(tags || []).slice(0, compact ? 2 : 3).map((tag) => (
        <span key={tag} className="badge secondary profile-role-chip">{tag}</span>
      ))}
    </div>
  );
}
