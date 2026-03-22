import { Grid3x3, LayoutGrid, List, Plus, RefreshCcw } from "lucide-react";
import React from "react";

export default function InventoryToolbarSection({
  isNarrowScreen,
  totalWeight,
  readOnly,
  onOpenTransfers,
  onStartAdd,
  onRefresh,
  q,
  setQ,
  view,
  setView,
  vis,
  setVis,
  rarity,
  setRarity,
  rarityOptions
}) {
  return (
    <>
      <div className="inv-header tf-page-head">
        <div className="inv-header-main tf-page-head-main">
          <div className="tf-overline">Adventure Loadout</div>
          <div className="inv-title-lg tf-page-title">Инвентарь</div>
          <div className="inv-subtitle">
            Вес (по фильтру): {totalWeight.toFixed(2)}
            {readOnly ? <span className="badge warn">только чтение</span> : null}
          </div>
        </div>
        {!isNarrowScreen ? (
          <div className="inv-header-actions tf-command-actions">
            <button className="btn secondary" onClick={onOpenTransfers}>Передачи</button>
            <button className="btn" onClick={onStartAdd} disabled={readOnly}><Plus className="icon" aria-hidden="true" />Добавить</button>
            <button className="btn secondary" onClick={onRefresh}><RefreshCcw className="icon" aria-hidden="true" />Обновить</button>
          </div>
        ) : null}
      </div>

      {isNarrowScreen ? (
        <div className="inv-mobile-sticky tf-panel tf-command-bar">
          <div className="inv-mobile-search">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по названию..."
              aria-label="Поиск предметов по названию"
            />
          </div>
          <div className="inv-mobile-quick-actions">
            <button className="btn secondary" onClick={onOpenTransfers}>Передачи</button>
            <button className="btn" onClick={onStartAdd} disabled={readOnly}><Plus className="icon" aria-hidden="true" />Добавить</button>
            <button className="btn secondary" onClick={onRefresh}><RefreshCcw className="icon" aria-hidden="true" />Обновить</button>
          </div>
        </div>
      ) : null}

      <div className="inv-panel inv-filters tf-panel tf-command-bar">
        <div className="inv-panel-head tf-section-head">
          <div className="tf-section-copy">
            <div className="tf-section-kicker">Command bar</div>
            <div className="inv-panel-title">Фильтры</div>
          </div>
          <div className="inv-view-toggle tf-segmented">
            <button className={`btn tf-segmented-btn ${view === "list" ? "tf-segmented-btn-active" : "secondary"}`.trim()} onClick={() => setView("list")}>
              <List className="icon" aria-hidden="true" />Список
            </button>
            <button className={`btn tf-segmented-btn ${view === "grid" ? "tf-segmented-btn-active" : "secondary"}`.trim()} onClick={() => setView("grid")}>
              <LayoutGrid className="icon" aria-hidden="true" />Плитка
            </button>
            <button className={`btn tf-segmented-btn ${view === "slots" ? "tf-segmented-btn-active" : "secondary"}`.trim()} onClick={() => setView("slots")}>
              <Grid3x3 className="icon" aria-hidden="true" />RPG
            </button>
          </div>
        </div>
        <div className="inv-filter-row">
          {!isNarrowScreen ? (
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по названию..."
              aria-label="Поиск предметов по названию"
            />
          ) : null}
          <select value={vis} onChange={(e) => setVis(e.target.value)} aria-label="Фильтр по видимости">
            <option value="">Видимость: все</option>
            <option value="public">Публичные</option>
            <option value="hidden">Скрытые</option>
          </select>
          <select value={rarity} onChange={(e) => setRarity(e.target.value)} aria-label="Фильтр по редкости">
            <option value="">Редкость: все</option>
            {rarityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
