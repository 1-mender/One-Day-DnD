import React from "react";
import { pickInventoryIcon } from "../../../components/vintage/inventoryItemCard/iconDomain.js";

export default function InventoryFavoritesSection({
  isNarrowScreen,
  mobileFavoritesOpen,
  setMobileFavoritesOpen,
  favorites,
  startInspect
}) {
  const summaryMeta = (
    <div className="inv-mobile-summary-meta" aria-hidden="true">
      <span className="inv-mobile-summary-pill">{favorites.length}</span>
      <span className="inv-mobile-summary-pill muted">
        {favorites.length ? "быстрые слоты" : "пусто"}
      </span>
    </div>
  );

  const content = favorites.length ? (
    <div className="inv-quick-list">
      {favorites.map((item) => {
        const icon = pickInventoryIcon(item);
        const qty = Number(item.qty) || 1;
        return (
          <button
            key={`fav_${item.id}`}
            type="button"
            className="inv-quick-item"
            onClick={() => startInspect(item)}
            title={`${item.name || ""} x${qty}`}
            aria-label={`${item.name || "Item"} x${qty}`}
          >
            {icon.Icon ? (
              <icon.Icon className="inv-quick-icon" aria-hidden="true" />
            ) : (
              <span className="inv-quick-fallback">{icon.text}</span>
            )}
            <span className="inv-quick-qty">x{qty}</span>
          </button>
        );
      })}
    </div>
  ) : (
    <div className="small inv-quick-empty">
      Добавьте предмет в избранное, чтобы он появился в быстрых слотах.
    </div>
  );

  if (isNarrowScreen) {
    return (
      <details
        className={`inv-panel inv-mobile-section inv-favorites tf-panel${favorites.length ? "" : " is-empty"}`.trim()}
        open={mobileFavoritesOpen}
        onToggle={(event) => setMobileFavoritesOpen(event.currentTarget.open)}
      >
        <summary className="inv-mobile-section-summary">
          <span className="inv-mobile-summary-copy">
            <span className="inv-mobile-summary-title">Избранное</span>
            <span className="inv-mobile-summary-subtitle">Быстрые слоты</span>
          </span>
          {summaryMeta}
        </summary>
        <div className="inv-mobile-section-body">
          {favorites.length ? <div className="small">Быстрые слоты предметов</div> : null}
          {content}
        </div>
      </details>
    );
  }

  return (
    <div className="inv-panel inv-favorites tf-panel">
      <div className="inv-panel-head tf-section-head">
        <div className="tf-section-copy">
          <div className="tf-section-kicker">Quick slots</div>
          <div className="inv-panel-title">Избранное</div>
        </div>
        <div className="small">Быстрые слоты предметов</div>
      </div>
      {content}
    </div>
  );
}
