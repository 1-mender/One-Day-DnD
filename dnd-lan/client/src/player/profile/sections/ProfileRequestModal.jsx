import { Send } from "lucide-react";
import Modal from "../../../components/Modal.jsx";
import { StatsEditor } from "../../../components/profile/StatsEditor.jsx";
import {
  PRESET_HINT,
  RACE_OPTIONS,
  getPresetStatsLabel,
  getRaceValue,
  mergePreset,
  setRaceInStats
} from "../../profileDomain.js";

const INPUT_STYLE = { width: "100%" };

export default function ProfileRequestModal({ controller }) {
  const {
    readOnly,
    requestDraft,
    requestOpen,
    requestPresets,
    requestReason,
    setRequestDraft,
    setRequestOpen,
    setRequestReason,
    submitRequest
  } = controller;

  return (
    <Modal open={requestOpen} title="Запрос изменения профиля" onClose={() => setRequestOpen(false)}>
      <div className="list">
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
                onClick={() => setRequestDraft((current) => mergePreset(current, preset))}
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
        <input
          value={requestDraft.characterName}
          onChange={(event) => setRequestDraft({ ...requestDraft, characterName: event.target.value })}
          placeholder="Имя персонажа"
          aria-label="Имя персонажа"
          maxLength={80}
          style={INPUT_STYLE}
        />
        <input
          value={requestDraft.classRole}
          onChange={(event) => setRequestDraft({ ...requestDraft, classRole: event.target.value })}
          placeholder="Класс / роль"
          aria-label="Класс или роль"
          maxLength={80}
          style={INPUT_STYLE}
        />
        <input
          value={requestDraft.level}
          onChange={(event) => setRequestDraft({ ...requestDraft, level: event.target.value })}
          placeholder="Уровень"
          aria-label="Уровень"
          style={INPUT_STYLE}
        />
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
        <input
          value={requestDraft.avatarUrl}
          onChange={(event) => setRequestDraft({ ...requestDraft, avatarUrl: event.target.value })}
          placeholder="URL аватара"
          aria-label="URL аватара"
          maxLength={512}
          style={INPUT_STYLE}
        />
        <button className="btn" onClick={submitRequest}>
          <Send className="icon" aria-hidden="true" />Отправить запрос
        </button>
      </div>
    </Modal>
  );
}
