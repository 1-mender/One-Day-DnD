import React, { useState } from "react";

const SHIELD_MINIGAME_BASE_SRC = "/mini-game/shield/?embed=1&v=20260417";

function buildShieldMinigameSrc(version) {
  return `${SHIELD_MINIGAME_BASE_SRC}&reload=${version}`;
}

export default function ShieldMinigame() {
  const [reloadVersion, setReloadVersion] = useState(() => Date.now());
  const iframeSrc = buildShieldMinigameSrc(reloadVersion);

  return (
    <div className="shield-minigame-shell">
      <div className="shield-minigame-bar">
        <div className="shield-minigame-status">
          <span className="eyebrow">Live activity</span>
          <strong>Щиток открыт мастером</strong>
        </div>
        <div className="shield-minigame-actions">
          <button
            className="shield-minigame-action"
            type="button"
            onClick={() => setReloadVersion(Date.now())}
          >
            Перезагрузить
          </button>
          <a
            className="shield-minigame-action"
            href={iframeSrc}
            target="_blank"
            rel="noreferrer"
          >
            Открыть отдельно
          </a>
        </div>
      </div>
      <div className="shield-minigame-frame-wrap">
        <iframe
          key={reloadVersion}
          className="shield-minigame-frame"
          src={iframeSrc}
          title="Щиток"
          allow="autoplay"
        />
      </div>
    </div>
  );
}
