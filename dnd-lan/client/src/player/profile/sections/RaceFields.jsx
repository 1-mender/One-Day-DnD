import {
  RACE_OPTIONS,
  formatRaceBonus,
  getRaceProfile,
  getRaceValue,
  getRaceVariantOptions,
  getRaceVariantValue,
  setRaceInStats,
  setRaceVariantInStats
} from "../../profileDomain.js";

const FIELD_STYLE = { width: "100%" };

export default function RaceFields({ stats, onChange, disabled = false }) {
  const raceValue = getRaceValue(stats);
  const variantValue = getRaceVariantValue(stats);
  const variantOptions = getRaceVariantOptions(raceValue);
  const raceProfile = getRaceProfile(stats);
  const bonusLabel = formatRaceBonus(raceProfile.carryBonus);

  const handleRaceChange = (event) => {
    onChange?.(setRaceInStats(stats, event.target.value));
  };

  const handleVariantChange = (event) => {
    onChange?.(setRaceVariantInStats(stats, event.target.value));
  };

  return (
    <div className="race-fields">
      <div className="race-fields-grid">
        <label className="race-field">
          <span className="small note-hint">Базовая раса</span>
          <select
            value={raceValue}
            onChange={handleRaceChange}
            aria-label="Раса"
            disabled={disabled}
            style={FIELD_STYLE}
          >
            {RACE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="race-field">
          <span className="small note-hint">Происхождение</span>
          <select
            value={variantValue}
            onChange={handleVariantChange}
            aria-label="Происхождение расы"
            disabled={disabled}
            style={FIELD_STYLE}
          >
            {variantOptions.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="race-summary-card">
        <div className="race-summary-head">
          <div>
            <div className="profile-section-kicker tf-section-kicker">Origin</div>
            <div className="title race-summary-title">{raceProfile.displayName}</div>
          </div>
          <span className={`badge ${raceProfile.carryBonus > 0 ? "ok" : raceProfile.carryBonus < 0 ? "off" : "secondary"}`}>
            вес {bonusLabel}
          </span>
        </div>
        <div className="small note-hint">{raceProfile.trait || raceProfile.raceLabel}</div>
        <div className="small race-summary-description">
          {raceProfile.variantDescription || raceProfile.description}
        </div>
        {raceProfile.tags.length ? (
          <div className="race-tag-list">
            {raceProfile.tags.map((tag) => (
              <span key={tag} className="badge secondary race-tag">{tag}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
