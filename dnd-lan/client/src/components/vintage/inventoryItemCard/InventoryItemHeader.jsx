import React from "react";
import { Eye, EyeOff } from "lucide-react";
import RarityBadge from "../RarityBadge.jsx";

export default function InventoryItemHeader({
  itemName,
  icon,
  quickOpen,
  setQuickOpen,
  hapticTap,
  hasActions,
  showActions,
  actionsId,
  isMobile,
  qty,
  isHidden,
  visibilityLabel,
  weight,
  rarityKey,
  rarityLabel,
  reservedQty,
  availableQty,
  lite,
  tags,
  updatedBy,
}) {
  return (
    <div className="inv-card-header">
      <div className="inv-icon-wrap" aria-hidden="true">
        {icon.Icon ? (
          <icon.Icon className="inv-icon" aria-hidden="true" />
        ) : (
          <div className="inv-fallback">{icon.text}</div>
        )}
      </div>
      <div className="inv-body">
        <div className="inv-title-row">
          <div className="inv-title">{itemName || "Без названия"}</div>
          <div className="inv-title-right">
            <RarityBadge rarity={rarityKey} />
            {hasActions ? (
              <button
                type="button"
                className={`inv-quick-toggle${quickOpen ? " active" : ""}`}
                onClick={() => {
                  setQuickOpen((prev) => {
                    const next = !prev;
                    if (next) hapticTap(6);
                    return next;
                  });
                }}
                aria-expanded={quickOpen ? "true" : "false"}
                aria-controls={showActions ? actionsId : undefined}
                aria-label="Быстрые действия"
                title="Быстрые действия"
              >
                <span className="inv-quick-dots" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
        <div className={`inv-meta-row${isMobile ? " inv-meta-row-mobile" : ""}`.trim()}>
          <span className="inv-chip">x{qty}</span>
          <span className={`inv-chip ${isHidden ? "off" : "ok"}`}>
            {isHidden ? <EyeOff className="icon" aria-hidden="true" /> : <Eye className="icon" aria-hidden="true" />}
            {visibilityLabel}
          </span>
          <span className="inv-chip">Вес: {weight.toFixed(2)}</span>
          {!isMobile ? <span className="inv-chip secondary">Редкость: {rarityLabel}</span> : null}
          {reservedQty > 0 ? (
            <span className="inv-chip warn" title={`В резерве: ${reservedQty}`} aria-label={`В резерве: ${reservedQty}`}>
              Доступно: {availableQty}
            </span>
          ) : null}
        </div>
        {!lite && tags?.length > 0 ? (
          <div className={`inv-tags${isMobile ? " inv-tags-mobile" : ""}`.trim()}>
            {tags.slice(0, isMobile ? 2 : 4).map((tag) => (
              <span key={tag} className="inv-tag">#{tag}</span>
            ))}
          </div>
        ) : null}
        {updatedBy === "dm" ? (
          <div className="inv-note small">изменено DM</div>
        ) : null}
      </div>
    </div>
  );
}
