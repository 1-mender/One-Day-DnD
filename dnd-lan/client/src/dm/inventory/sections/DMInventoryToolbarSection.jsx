import { Plus, RefreshCcw } from "lucide-react";
import { FilterBar } from "../../../foundation/primitives/index.js";
import { t } from "../../../i18n/index.js";

export default function DMInventoryToolbarSection({
  players,
  readOnly,
  selectedId,
  setSelectedId,
  startAdd,
  refresh
}) {
  return (
    <div className="dm-inv-panel tf-panel">
      <div className="tf-section-copy">
        <div className="tf-section-kicker">Roster target</div>
        <div className="dm-inv-panel-title">Игрок</div>
      </div>
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
      </FilterBar>
    </div>
  );
}
