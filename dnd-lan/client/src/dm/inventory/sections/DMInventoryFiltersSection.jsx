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
    <div className="dm-inv-panel tf-panel dm-inv-panel-filters">
      <div className="tf-section-copy">
        <div className="tf-section-kicker">Inventory filters</div>
        <div className="dm-inv-panel-title">Фильтры</div>
      </div>
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
      <div className="dm-inv-view tf-segmented">
        <button className={`btn tf-segmented-btn ${view === "list" ? "tf-segmented-btn-active" : "secondary"}`} onClick={() => setView("list")}>
          <List className="icon" aria-hidden="true" />{t("dmInventory.viewList")}
        </button>
        <button className={`btn tf-segmented-btn ${view === "grid" ? "tf-segmented-btn-active" : "secondary"}`} onClick={() => setView("grid")}>
          <LayoutGrid className="icon" aria-hidden="true" />{t("dmInventory.viewGrid")}
        </button>
      </div>
      <div className="dm-inv-stats tf-stat-grid">
        <div className="tf-stat-card">
          <div className="small"><Package className="icon" aria-hidden="true" />Всего</div>
          <strong>{filteredCount}</strong>
        </div>
        <div className="tf-stat-card">
          <div className="small"><Eye className="icon" aria-hidden="true" />Публичные</div>
          <strong>{publicCount}</strong>
        </div>
        <div className="tf-stat-card">
          <div className="small"><EyeOff className="icon" aria-hidden="true" />Скрытые</div>
          <strong>{hiddenCount}</strong>
        </div>
        <div className="tf-stat-card">
          <div className="small"><Scale className="icon" aria-hidden="true" />Вес</div>
          <strong>{totalWeightAll.toFixed(2)}</strong>
        </div>
      </div>
    </div>
  );
}
