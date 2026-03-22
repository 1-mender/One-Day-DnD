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
        <summary className="inv-mobile-section-summary">Показатели</summary>
        <div className="inv-mobile-section-body">{stats}</div>
      </details>
    );
  }

  return stats;
}
