import React from "react";
import { ErrorBanner } from "../../../foundation/primitives/index.js";
import InventoryItemsBody from "./InventoryItemsBody.jsx";

export default function InventoryItemsSection({
  err,
  load,
  loading,
  view,
  filtered,
  hasAny,
  readOnly,
  layoutSaving,
  isNarrowScreen,
  moveLayoutItems,
  startInspect,
  startEdit,
  startTransfer,
  toggleFavorite,
  del,
  handleGridSplitRequest,
  quickEquip,
  lite,
  listRef,
  actionsVariant,
  toggleVisibility
}) {
  const viewLabel = view === "slots" ? "RPG-сетка" : view === "grid" ? "Плитка" : "Список";
  const compactItemsHead = isNarrowScreen && view === "slots";

  return (
    <div className="inv-panel inv-items tf-panel tf-items-panel">
      <div className={`inv-panel-head tf-section-head${compactItemsHead ? " inv-panel-head-compact" : ""}`.trim()}>
        <div className={`tf-section-copy${compactItemsHead ? " inv-items-head-copy" : ""}`.trim()}>
          <div className="tf-section-kicker">Loadout archive</div>
          <div className="inv-panel-title">Предметы</div>
        </div>
        <div className={`small${compactItemsHead ? " inv-items-head-meta" : ""}`.trim()}>Режим: {viewLabel}</div>
      </div>
      <ErrorBanner message={err} onRetry={load} />
      <InventoryItemsBody
        loading={loading}
        view={view}
        filtered={filtered}
        hasAny={hasAny}
        readOnly={readOnly}
        layoutSaving={layoutSaving}
        isNarrowScreen={isNarrowScreen}
        moveLayoutItems={moveLayoutItems}
        startInspect={startInspect}
        startEdit={startEdit}
        startTransfer={startTransfer}
        toggleFavorite={toggleFavorite}
        del={del}
        handleGridSplitRequest={handleGridSplitRequest}
        quickEquip={quickEquip}
        lite={lite}
        listRef={listRef}
        actionsVariant={actionsVariant}
        toggleVisibility={toggleVisibility}
      />
    </div>
  );
}
