import React from "react";

const SHIELD_MINIGAME_SRC = "/mini-game/shield/?embed=1&v=20260413-4";

export default function ShieldMinigame() {
  return (
    <div className="card taped shield-minigame-shell">
      <div className="shield-minigame-head">
        <div className="title">Щиток</div>
        <div className="small">Временная мини-игра, которую мастер открыл для этого игрока.</div>
      </div>
      <div className="shield-minigame-frame-wrap">
        <iframe
          className="shield-minigame-frame"
          src={SHIELD_MINIGAME_SRC}
          title="Щиток"
          allow="autoplay"
        />
      </div>
    </div>
  );
}
