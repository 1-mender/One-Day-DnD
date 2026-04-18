import { Send } from "lucide-react";
import Modal from "../../../components/Modal.jsx";
import { StatsEditor } from "../../../components/profile/StatsEditor.jsx";
import {
  PRESET_HINT,
  RACE_OPTIONS,
  formatReputationLabel,
  getReputationTier,
  getPresetStatsLabel,
  getRaceValue,
  setRaceInStats
} from "../../profileDomain.js";

const INPUT_STYLE = { width: "100%" };

export default function ProfileRequestModal({ controller }) {
  const {
    applyRequestPreset,
    readOnly,
    requestableFields,
    requestDraft,
    requestOpen,
    requestPresets,
    requestReason,
    setRequestDraft,
    setRequestOpen,
    setRequestReason,
    submitRequest
  } = controller;
  const canRequestBasic = requestableFields.some((field) => ["characterName", "classRole", "level", "reputation"].includes(field));
  const canRequestStats = requestableFields.includes("stats");
  const canRequestBio = requestableFields.includes("bio");
  const canRequestAvatar = requestableFields.includes("avatarUrl");

  return (
    <Modal open={requestOpen} title="Запрос изменения профиля" onClose={() => setRequestOpen(false)}>
      <div className="list">
        <div className="small note-hint">
          Здесь показаны только поля, которые нельзя изменить напрямую.
        </div>
        <div className="preset-panel">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <div className="title">Шаблоны профиля</div>
            <div className="small">{PRESET_HINT}</div>
          </div>
          <div className="preset-grid">
            {requestPresets.map((preset) => (
              <button
                key={preset.id || preset.key || preset.title}
                type="button"
                className="preset-card"
                onClick={() => applyRequestPreset(preset)}
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
        <textarea
          value={requestReason}
          onChange={(event) => setRequestReason(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Причина запроса (опционально, до 500 символов)"
          aria-label="Причина запроса"
          style={INPUT_STYLE}
        />
        <div className="small">{String(requestReason || "").length}/500</div>
        {canRequestBasic ? (
          <>
            {requestableFields.includes("characterName") ? (
              <input
                value={requestDraft.characterName}
                onChange={(event) => setRequestDraft({ ...requestDraft, characterName: event.target.value })}
                placeholder="Имя персонажа"
                aria-label="Имя персонажа"
                maxLength={80}
                style={INPUT_STYLE}
              />
            ) : null}
            {requestableFields.includes("classRole") ? (
              <input
                value={requestDraft.classRole}
                onChange={(event) => setRequestDraft({ ...requestDraft, classRole: event.target.value })}
                placeholder="Класс / роль"
                aria-label="Класс или роль"
                maxLength={80}
                style={INPUT_STYLE}
              />
            ) : null}
            {requestableFields.includes("level") ? (
              <input
                value={requestDraft.level}
                onChange={(event) => setRequestDraft({ ...requestDraft, level: event.target.value })}
                placeholder="Уровень"
                aria-label="Уровень"
                style={INPUT_STYLE}
              />
            ) : null}
            {requestableFields.includes("reputation") ? (
              <label className="list">
                <span className="small note-hint">Репутация: от -100 до 100</span>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={requestDraft.reputation}
                  onChange={(event) => setRequestDraft({ ...requestDraft, reputation: event.target.value })}
                  placeholder="Репутация"
                  aria-label="Репутация"
                  style={INPUT_STYLE}
                />
                <span className={`badge ${getReputationTier(requestDraft.reputation).tone}`}>
                  {formatReputationLabel(requestDraft.reputation)}
                </span>
              </label>
            ) : null}
          </>
        ) : null}
        {canRequestStats ? (
          <>
            <select
              value={getRaceValue(requestDraft.stats)}
              onChange={(event) => setRequestDraft({ ...requestDraft, stats: setRaceInStats(requestDraft.stats, event.target.value) })}
              aria-label="Раса"
              style={INPUT_STYLE}
            >
              {RACE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <StatsEditor value={requestDraft.stats} onChange={(stats) => setRequestDraft({ ...requestDraft, stats })} readOnly={readOnly} />
          </>
        ) : null}
        {canRequestBio ? (
          <>
            <textarea
              value={requestDraft.bio}
              onChange={(event) => setRequestDraft({ ...requestDraft, bio: event.target.value })}
              rows={6}
              maxLength={2000}
              placeholder="Биография (до 2000 символов)"
              aria-label="Биография"
              style={INPUT_STYLE}
            />
            <div className="small">{String(requestDraft.bio || "").length}/2000</div>
          </>
        ) : null}
        {canRequestAvatar ? (
          <input
            value={requestDraft.avatarUrl}
            onChange={(event) => setRequestDraft({ ...requestDraft, avatarUrl: event.target.value })}
            placeholder="URL аватара"
            aria-label="URL аватара"
            maxLength={512}
            style={INPUT_STYLE}
          />
        ) : null}
        <button className="btn" onClick={submitRequest}>
          <Send className="icon" aria-hidden="true" />Отправить запрос
        </button>
      </div>
    </Modal>
  );
}
