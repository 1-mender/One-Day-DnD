import { ImageUp } from "lucide-react";
import Modal from "../../../components/Modal.jsx";
import { StatsEditor } from "../../../components/profile/StatsEditor.jsx";
import {
  PRESET_HINT,
  RACE_OPTIONS,
  getPresetStatsLabel,
  getRaceValue,
  setRaceInStats
} from "../../profileDomain.js";

const INPUT_STYLE = { width: "100%" };

export default function ProfileEditModal({ controller }) {
  const {
    applyEditPreset,
    canEdit,
    draft,
    editMode,
    editPresets,
    fileInputRef,
    handleAvatarFileChange,
    readOnly,
    saveEdit,
    setDraft,
    setEditMode,
    uploading
  } = controller;

  return (
    <Modal open={!!editMode} title="Редактировать профиль" onClose={() => setEditMode("")}>
      <div className="list">
        <div className="preset-panel">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <div className="title">Шаблоны профиля</div>
            <div className="small">{PRESET_HINT}</div>
          </div>
          <div className="preset-grid">
            {editPresets.map((preset) => (
              <button
                key={preset.id || preset.key || preset.title}
                type="button"
                className="preset-card"
                onClick={() => applyEditPreset(preset)}
              >
                <div className="preset-title">{preset.title}</div>
                <div className="small">{preset.subtitle}</div>
                {preset.source === "dm" ? (
                  <span className="badge secondary" style={{ alignSelf: "flex-start", marginTop: 6 }}>DM</span>
                ) : null}
                <div className="preset-meta">{getPresetStatsLabel(preset)}</div>
              </button>
            ))}
          </div>
        </div>

        {editMode === "basic" ? (
          <>
            <div className="small note-hint">Меняются только разрешённые поля.</div>
            {canEdit("characterName") ? (
              <input
                value={draft.characterName}
                onChange={(event) => setDraft({ ...draft, characterName: event.target.value })}
                placeholder="Имя персонажа"
                aria-label="Имя персонажа"
                maxLength={80}
                style={INPUT_STYLE}
              />
            ) : null}
            {canEdit("classRole") ? (
              <input
                value={draft.classRole}
                onChange={(event) => setDraft({ ...draft, classRole: event.target.value })}
                placeholder="Класс / роль"
                aria-label="Класс или роль"
                maxLength={80}
                style={INPUT_STYLE}
              />
            ) : null}
            {canEdit("level") ? (
              <input
                value={draft.level}
                onChange={(event) => setDraft({ ...draft, level: event.target.value })}
                placeholder="Уровень"
                aria-label="Уровень"
                style={INPUT_STYLE}
              />
            ) : null}
          </>
        ) : null}

        {editMode === "stats" ? (
          <>
            <div className="small note-hint">Раса влияет на лимит веса инвентаря.</div>
            <select
              value={getRaceValue(draft.stats)}
              onChange={(event) => setDraft({ ...draft, stats: setRaceInStats(draft.stats, event.target.value) })}
              aria-label="Раса"
              style={INPUT_STYLE}
            >
              {RACE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <StatsEditor value={draft.stats} onChange={(stats) => setDraft({ ...draft, stats })} readOnly={readOnly} />
          </>
        ) : null}

        {editMode === "bio" ? (
          <>
            <textarea
              value={draft.bio}
              onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
              rows={8}
              maxLength={2000}
              placeholder="Биография (до 2000 символов)"
              aria-label="Биография"
              style={INPUT_STYLE}
            />
            <div className="small">{String(draft.bio || "").length}/2000</div>
          </>
        ) : null}

        {editMode === "avatar" ? (
          <>
            <div className="small note-hint">Можно вставить URL или загрузить файл.</div>
            <input
              value={draft.avatarUrl}
              onChange={(event) => setDraft({ ...draft, avatarUrl: event.target.value })}
              placeholder="URL аватара"
              aria-label="URL аватара"
              maxLength={512}
              style={INPUT_STYLE}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFileChange}
              aria-label="Загрузить аватар"
              style={{ display: "none" }}
            />
            <button className="btn secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <ImageUp className="icon" aria-hidden="true" />{uploading ? "Загрузка..." : "Загрузить файл"}
            </button>
          </>
        ) : null}

        <button className="btn" onClick={saveEdit}>Сохранить</button>
      </div>
    </Modal>
  );
}
