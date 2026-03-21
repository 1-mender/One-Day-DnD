import { Eye, EyeOff, LayoutGrid, List, Package, Scale } from "lucide-react";
import { FilterBar } from "../../../foundation/primitives/index.js";
import { t } from "../../../i18n/index.js";

export default function DMInventoryFiltersSection({
  filteredCount,
  hiddenCount,
  q,
  rarity,
  rarityOptions,
  setQ,
  setRarity,
  setView,
  setVis,
  totalWeightAll,
  publicCount,
  view,
  vis
}) {
  return (
    <div className="dm-inv-panel">
      <div className="dm-inv-panel-title">Фильтры</div>
      <FilterBar>
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={t("dmInventory.searchPlaceholder")}
          aria-label="Поиск предметов игрока"
          className="u-w-min-360"
        />
        <select value={vis} onChange={(event) => setVis(event.target.value)} aria-label="Фильтр видимости предметов" className="u-w-180">
          <option value="">{t("dmInventory.visibilityAll")}</option>
          <option value="public">{t("dmInventory.visibilityPublic")}</option>
          <option value="hidden">{t("dmInventory.visibilityHidden")}</option>
        </select>
        <select value={rarity} onChange={(event) => setRarity(event.target.value)} aria-label="Фильтр редкости предметов" className="u-w-180">
          <option value="">{t("dmInventory.rarityAll")}</option>
          {rarityOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </FilterBar>
      <div className="dm-inv-view">
        <button className={`btn ${view === "list" ? "" : "secondary"}`} onClick={() => setView("list")}>
          <List className="icon" aria-hidden="true" />{t("dmInventory.viewList")}
        </button>
        <button className={`btn ${view === "grid" ? "" : "secondary"}`} onClick={() => setView("grid")}>
          <LayoutGrid className="icon" aria-hidden="true" />{t("dmInventory.viewGrid")}
        </button>
      </div>
      <div className="dm-inv-stats">
        <span className="badge"><Package className="icon" aria-hidden="true" />{t("dmInventory.totalItems", { count: filteredCount })}</span>
        <span className="badge ok"><Eye className="icon" aria-hidden="true" />{t("dmInventory.totalPublic", { count: publicCount })}</span>
        <span className="badge off"><EyeOff className="icon" aria-hidden="true" />{t("dmInventory.totalHidden", { count: hiddenCount })}</span>
        <span className="badge secondary"><Scale className="icon" aria-hidden="true" />{t("dmInventory.totalWeight", { value: totalWeightAll.toFixed(2) })}</span>
      </div>
    </div>
  );
}
