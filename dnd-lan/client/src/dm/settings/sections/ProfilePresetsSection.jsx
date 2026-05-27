import React from "react";
import { StatsEditor, StatsView } from "../../../components/profile/StatsEditor.jsx";
import PolaroidFrame from "../../../components/vintage/PolaroidFrame.jsx";
import { formatReputationLabel } from "../../../player/profileDomain.js";
import { PROFILE_HIDDEN_STAT_KEYS } from "../../../player/profileDomain.js";
import { joinProfileTags } from "../../../profileCatalogDomain.js";
import {
  applyDmProfileTemplate,
  detectDmProfileTemplate,
  DM_PROFILE_STAT_LABELS,
  DM_PROFILE_TEMPLATES,
  getDmProfileTemplate
} from "../../playerProfile/playerProfileAdminDomain.js";
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
  profileCatalogs,
  removePreset,
  updatePreset,
  updatePresetData,
  addCatalogEntry,
  removeCatalogEntry,
  updateCatalogEntry
}) {
  return (
    <div className="card taped">
      <div className="u-fw-800">{"Пресеты профиля"}</div>
      <div className="small">{"Шаблоны профиля и каталоги сеттинга для игроков."}</div>
      <hr />
      {presetErr ? <div className="badge off">{"Ошибка: "}{presetErr}</div> : null}
      {presetMsg ? <div className="badge ok">{presetMsg}</div> : null}
      <div className="list">
        <label className="row">
          <input
            type="checkbox"
            checked={presetAccess.enabled !== false}
            onChange={(e) => setPresetAccess({ ...presetAccess, enabled: e.target.checked })}
            disabled={readOnly}
          />
          <span>{"Включить пресеты для игроков"}</span>
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={presetAccess.playerEdit !== false}
            onChange={(e) => setPresetAccess({ ...presetAccess, playerEdit: e.target.checked })}
            disabled={readOnly}
          />
          <span>{"Разрешить применение в прямом редактировании"}</span>
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={presetAccess.playerRequest !== false}
            onChange={(e) => setPresetAccess({ ...presetAccess, playerRequest: e.target.checked })}
            disabled={readOnly}
          />
          <span>{"Разрешить применение в запросах"}</span>
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={!!presetAccess.hideLocal}
            onChange={(e) => setPresetAccess({ ...presetAccess, hideLocal: e.target.checked })}
            disabled={readOnly}
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
                    disabled={readOnly}
                  />
                  <input
                    value={preset.subtitle || ""}
                    onChange={(e) => updatePreset(idx, { subtitle: e.target.value })}
                    placeholder={"Подзаголовок / описание"}
                    aria-label="Подзаголовок пресета"
                    maxLength={160}
                    style={inp}
                    disabled={readOnly}
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
                      disabled={readOnly}
                    />
                    <input
                      value={preset.data?.classRole || ""}
                      onChange={(e) => updatePresetData(idx, { classRole: e.target.value })}
                      placeholder={"Роль / архетип / профессия"}
                      aria-label="Роль или архетип в пресете"
                      maxLength={80}
                      style={inp}
                      className="u-minw-220"
                      disabled={readOnly}
                    />
                    <input
                      value={preset.data?.level ?? ""}
                      onChange={(e) => updatePresetData(idx, { level: e.target.value })}
                      placeholder={"Уровень"}
                      aria-label="Уровень в пресете"
                      style={inp}
                      className="u-minw-140"
                      disabled={readOnly}
                    />
                    <input
                      type="number"
                      min="-100"
                      max="100"
                      value={preset.data?.reputation ?? 0}
                      onChange={(e) => updatePresetData(idx, { reputation: e.target.value })}
                      placeholder={"Репутация"}
                      aria-label="Репутация в пресете"
                      style={inp}
                      className="u-minw-140"
                      disabled={readOnly}
                    />
                  </div>
                  <div className="preset-panel">
                    <div className="row u-row-between-baseline">
                      <div className="small">Шаблон сеттинга</div>
                      <div className="small note-hint">Быстро меняет базовые атрибуты заготовки.</div>
                    </div>
                    <div className="preset-grid">
                      {DM_PROFILE_TEMPLATES.map((template) => {
                        const currentTemplateKey = detectDmProfileTemplate(preset.data || {});
                        return (
                          <button
                            key={`${preset.id || idx}-${template.key}`}
                            type="button"
                            className={`preset-card${currentTemplateKey === template.key ? " is-active" : ""}`}
                            onClick={() => updatePresetData(idx, applyDmProfileTemplate(preset.data || {}, template.key))}
                            disabled={readOnly}
                          >
                            <div className="preset-title">{template.label}</div>
                            <div className="small">{template.summary}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="kv">
                    <div className="title">{"Статы"}</div>
                    <StatsEditor
                      value={preset.data?.stats || {}}
                      onChange={(stats) => updatePresetData(idx, { stats })}
                      readOnly={readOnly}
                      defaultKeys={getDmProfileTemplate(detectDmProfileTemplate(preset.data || {})).statKeys}
                      keyLabels={DM_PROFILE_STAT_LABELS}
                      addLabel="+ Добавить поле"
                      hiddenKeys={PROFILE_HIDDEN_STAT_KEYS}
                    />
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
                          {preset.data?.classRole || "Роль/архетип"} • lvl {preset.data?.level || "?"} • реп. {formatReputationLabel(preset.data?.reputation)}
                        </div>
                      </div>
                    </div>
                    <div className="u-mt-10">
                      <StatsView stats={preset.data?.stats || {}} keyLabels={DM_PROFILE_STAT_LABELS} hiddenKeys={PROFILE_HIDDEN_STAT_KEYS} />
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
                    disabled={readOnly}
                  />
                  <input
                    value={preset.data?.avatarUrl || ""}
                    onChange={(e) => updatePresetData(idx, { avatarUrl: e.target.value })}
                    placeholder={"URL аватара"}
                    aria-label="URL аватара в пресете"
                    maxLength={512}
                    style={inp}
                    disabled={readOnly}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <hr />

        <div className="u-fw-800">Каталоги сеттинга</div>
        <div className="small">Роли, классы, происхождения и расы, которые мастер применяет к профилям без правки кода.</div>

        <div className="paper-note u-mt-10">
          <div className="row u-row-between-center">
            <div className="title">Каталог ролей / классов</div>
            <button className="btn secondary" type="button" onClick={() => addCatalogEntry("roles")} disabled={readOnly}>
              + Добавить роль
            </button>
          </div>
          <div className="small note-hint u-mt-6">
            Эти записи подставляются в профиль как роль, описание и теги. Игрок остаётся редактируемым вручную.
          </div>
          <div className="list u-mt-10">
            {(profileCatalogs?.roles || []).length === 0 ? (
              <div className="badge warn">Каталог ролей пока пуст.</div>
            ) : (
              profileCatalogs.roles.map((entry, index) => (
                <CatalogEntryEditor
                  key={entry.id || `role-${index}`}
                  title={`Роль #${index + 1}`}
                  entry={entry}
                  readOnly={readOnly}
                  onChange={(patch) => updateCatalogEntry("roles", index, patch)}
                  onRemove={() => removeCatalogEntry("roles", index)}
                />
              ))
            )}
          </div>
        </div>

        <div className="paper-note u-mt-10">
          <div className="row u-row-between-center">
            <div className="title">Каталог происхождений / рас</div>
            <button className="btn secondary" type="button" onClick={() => addCatalogEntry("origins")} disabled={readOnly}>
              + Добавить происхождение
            </button>
          </div>
          <div className="small note-hint u-mt-6">
            Здесь можно задать собственные виды, культуры, фракции или происхождения вместе с описанием, тегами и бонусом к лимиту веса.
          </div>
          <div className="list u-mt-10">
            {(profileCatalogs?.origins || []).length === 0 ? (
              <div className="badge warn">Каталог происхождений пока пуст.</div>
            ) : (
              profileCatalogs.origins.map((entry, index) => (
                <CatalogEntryEditor
                  key={entry.id || `origin-${index}`}
                  title={`Происхождение #${index + 1}`}
                  entry={entry}
                  readOnly={readOnly}
                  showCarryBonus
                  onChange={(patch) => updateCatalogEntry("origins", index, patch)}
                  onRemove={() => removeCatalogEntry("origins", index)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CatalogEntryEditor({ title, entry, readOnly, showCarryBonus = false, onChange, onRemove }) {
  return (
    <div className="paper-note">
      <div className="row u-row-between-center">
        <div className="title">{title}</div>
        <button className="btn danger" type="button" onClick={onRemove} disabled={readOnly}>Удалить</button>
      </div>
      <div className="list u-mt-10">
        <div className="row u-row-gap-8 u-row-wrap">
          <input
            value={entry.label || ""}
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder="Название"
            aria-label={`${title} название`}
            maxLength={80}
            style={inp}
            className="u-minw-220"
            disabled={readOnly}
          />
          <input
            value={entry.key || ""}
            onChange={(event) => onChange({ key: event.target.value })}
            placeholder="Ключ"
            aria-label={`${title} ключ`}
            maxLength={40}
            style={inp}
            className="u-minw-180"
            disabled={readOnly}
          />
          {showCarryBonus ? (
            <input
              type="number"
              min="-50"
              max="50"
              value={entry.carryBonus ?? 0}
              onChange={(event) => onChange({ carryBonus: event.target.value })}
              placeholder="Бонус веса"
              aria-label={`${title} бонус веса`}
              style={inp}
              className="u-minw-140"
              disabled={readOnly}
            />
          ) : null}
        </div>
        <textarea
          value={entry.description || ""}
          onChange={(event) => onChange({ description: event.target.value })}
          rows={4}
          maxLength={500}
          placeholder="Описание и суть записи"
          aria-label={`${title} описание`}
          style={inp}
          disabled={readOnly}
        />
        <input
          value={joinProfileTags(entry.tags)}
          onChange={(event) => onChange({ tags: event.target.value })}
          placeholder="Теги через запятую"
          aria-label={`${title} теги`}
          maxLength={280}
          style={inp}
          disabled={readOnly}
        />
        <div className="row u-row-gap-8 u-row-wrap">
          <span className="badge secondary">{entry.key || "без ключа"}</span>
          <span className="badge secondary">{(entry.label || "Без названия").slice(0, 48)}</span>
          {joinProfileTags(entry.tags).split(", ").filter(Boolean).slice(0, 4).map((tag) => (
            <span key={tag} className="badge secondary">{tag}</span>
          ))}
          {showCarryBonus ? <span className="badge secondary">вес {Number(entry.carryBonus || 0) >= 0 ? "+" : ""}{Number(entry.carryBonus || 0)}</span> : null}
        </div>
      </div>
    </div>
  );
}
