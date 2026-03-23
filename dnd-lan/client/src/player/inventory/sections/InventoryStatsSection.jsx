import { Eye, EyeOff, Package, Scale } from "lucide-react";
import React from "react";

export default function InventoryStatsSection({
  isNarrowScreen,
  mobileStatsOpen,
  setMobileStatsOpen,
  filteredCount,
  publicCount,
  hiddenCount,
  weightStatus,
  totalWeightAll,
  hasWeightLimit,
  maxWeight
}) {
  const summaryMeta = (
    <div className="inv-mobile-summary-meta" aria-hidden="true">
      <span className="inv-mobile-summary-pill">{filteredCount} шт.</span>
      <span className={`inv-mobile-summary-pill ${weightStatus}`.trim()}>
        {totalWeightAll.toFixed(1)}
        {hasWeightLimit ? ` / ${maxWeight}` : ""}
      </span>
    </div>
  );

  const stats = (
    <div className="inv-stats tf-stat-grid">
      <div className="inv-stat tf-stat-card">
        <Package className="icon" aria-hidden="true" />
        <div>
          <div className="inv-stat-label">Всего</div>
          <div className="inv-stat-value">{filteredCount}</div>
        </div>
      </div>
      <div className="inv-stat tf-stat-card">
        <Eye className="icon" aria-hidden="true" />
        <div>
          <div className="inv-stat-label">Публичные</div>
          <div className="inv-stat-value">{publicCount}</div>
        </div>
      </div>
      <div className="inv-stat tf-stat-card">
        <EyeOff className="icon" aria-hidden="true" />
        <div>
          <div className="inv-stat-label">Скрытые</div>
          <div className="inv-stat-value">{hiddenCount}</div>
        </div>
      </div>
      <div className={`inv-stat tf-stat-card ${weightStatus}`.trim()}>
        <Scale className="icon" aria-hidden="true" />
        <div>
          <div className="inv-stat-label">Вес</div>
          <div className="inv-stat-value">
            {totalWeightAll.toFixed(2)} {hasWeightLimit ? ` / ${maxWeight}` : " / ∞"}
          </div>
        </div>
      </div>
    </div>
  );

  if (isNarrowScreen) {
    return (
      <details
        className="inv-panel inv-mobile-section tf-panel"
        open={mobileStatsOpen}
        onToggle={(event) => setMobileStatsOpen(event.currentTarget.open)}
      >
        <summary className="inv-mobile-section-summary">
          <span className="inv-mobile-summary-copy">
            <span className="inv-mobile-summary-title">Показатели</span>
            <span className="inv-mobile-summary-subtitle">Вес и видимость</span>
          </span>
          {summaryMeta}
        </summary>
        <div className="inv-mobile-section-body">{stats}</div>
      </details>
    );
  }

  return (
    <section className="inv-stats-block">
      <div className="tf-section-copy inv-stats-copy">
        <div className="tf-section-kicker">Party metrics</div>
        <div className="small">Сводка по текущему фильтру и общему весу персонажа.</div>
      </div>
      {stats}
    </section>
  );
}
