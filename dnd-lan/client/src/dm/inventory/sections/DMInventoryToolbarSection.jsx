import { Plus, RefreshCcw } from "lucide-react";
import { FilterBar } from "../../../foundation/primitives/index.js";
import { t } from "../../../i18n/index.js";

export default function DMInventoryToolbarSection({
  players,
  quickAccess,
  readOnly,
  selectedId,
  setSelectedId,
  startAdd,
  refresh
}) {
  const pinnedPlayers = quickAccess?.pinnedItems || [];
  const recentPlayers = quickAccess?.recentItems || [];
  const isPinned = quickAccess?.isPinned || (() => false);
  const togglePinned = quickAccess?.togglePinned || (() => {});

  return (
    <div className="dm-inv-panel tf-panel">
      <div className="tf-section-copy">
        <div className="tf-section-kicker">Roster target</div>
        <div className="dm-inv-panel-title">Игрок</div>
      </div>
      {pinnedPlayers.length || recentPlayers.length ? (
        <div className="dm-quick-access">
          {pinnedPlayers.length ? (
            <div className="dm-quick-access-group">
              <div className="tf-section-kicker">Закреплённые</div>
              <div className="dm-quick-access-chips">
                {pinnedPlayers.map((player) => (
                  <button
                    key={`pin-${player.id}`}
                    type="button"
                    className={`dm-quick-access-chip is-pinned${selectedId === player.id ? " is-active" : ""}`}
                    onClick={() => setSelectedId(player.id)}
                  >
                    {player.displayName || `#${player.id}`}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {recentPlayers.length ? (
            <div className="dm-quick-access-group">
              <div className="tf-section-kicker">Недавние</div>
              <div className="dm-quick-access-chips">
                {recentPlayers.map((player) => (
                  <button
                    key={`recent-${player.id}`}
                    type="button"
                    className={`dm-quick-access-chip${selectedId === player.id ? " is-active" : ""}`}
                    onClick={() => setSelectedId(player.id)}
                  >
                    {player.displayName || `#${player.id}`}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <FilterBar>
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(Number(event.target.value))}
          aria-label="Выбор игрока"
          className="u-w-full"
        >
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {t("dmInventory.playerOption", { name: player.displayName, id: player.id })}
            </option>
          ))}
        </select>
        <button className="btn" onClick={startAdd} disabled={readOnly || !selectedId}>
          <Plus className="icon" aria-hidden="true" />{t("dmInventory.issue")}
        </button>
        <button className="btn secondary" onClick={refresh} disabled={!selectedId}>
          <RefreshCcw className="icon" aria-hidden="true" />{t("dmInventory.refresh")}
        </button>
        {selectedId ? (
          <button
            type="button"
            className={`btn secondary${isPinned(selectedId) ? " is-active" : ""}`}
            onClick={() => togglePinned(selectedId)}
          >
            {isPinned(selectedId) ? "Убрать из закреплённых" : "Закрепить игрока"}
          </button>
        ) : null}
      </FilterBar>
    </div>
  );
}
