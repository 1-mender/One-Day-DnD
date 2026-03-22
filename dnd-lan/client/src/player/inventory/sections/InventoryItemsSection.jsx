import React from "react";
import ErrorBanner from "../../../components/ui/ErrorBanner.jsx";
import EmptyState from "../../../components/ui/EmptyState.jsx";
import Skeleton from "../../../components/ui/Skeleton.jsx";
import InventoryItemCard from "../../../components/vintage/InventoryItemCard.jsx";
import InventorySlotGrid from "../../InventorySlotGrid.jsx";

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
  return (
    <div className="inv-panel inv-items tf-panel tf-items-panel">
      <div className="inv-panel-head tf-section-head">
        <div className="inv-panel-title">Предметы</div>
        <div className="small">Все предметы инвентаря</div>
      </div>
      <ErrorBanner message={err} onRetry={load} />

      {loading ? (
        <div className="list">
          <div className="item"><Skeleton h={86} w="100%" /></div>
          <div className="item"><Skeleton h={86} w="100%" /></div>
          <div className="item"><Skeleton h={86} w="100%" /></div>
        </div>
      ) : view === "slots" ? (
        filtered.length === 0 ? (
          <EmptyState
            title={hasAny ? "Ничего не найдено" : "Инвентарь пуст"}
            hint={hasAny ? "Попробуйте изменить фильтры или поиск." : "Добавьте предмет, чтобы начать."}
          />
        ) : (
          <InventorySlotGrid
            items={filtered}
            readOnly={readOnly}
            busy={layoutSaving}
            touchOptimized={isNarrowScreen}
            onMove={moveLayoutItems}
            onItemOpen={(item) => startEdit(item)}
            onTransferItem={(item) => startTransfer(item)}
            onToggleFavoriteItem={(item) => toggleFavorite(item)}
            onDeleteItem={(item) => del(item.id)}
            onSplitItem={handleGridSplitRequest}
            onQuickEquipItem={(item) => quickEquip(item)}
          />
        )
      ) : filtered.length === 0 ? (
        <EmptyState
          title={hasAny ? "Ничего не найдено" : "Инвентарь пуст"}
          hint={hasAny ? "Попробуйте изменить фильтры или поиск." : "Добавьте предмет, чтобы начать."}
        />
      ) : (
        <div className={`list inv-shelf tf-item-list ${view === "grid" ? "inv-grid tf-item-grid" : ""}`.trim()} ref={lite ? null : listRef}>
          {filtered.map((item) => (
            <InventoryItemCard
              key={item.id}
              item={item}
              readOnly={readOnly}
              actionsVariant={actionsVariant}
              lite={lite}
              onEdit={() => startEdit(item)}
              onDelete={() => del(item.id)}
              onToggleVisibility={() => toggleVisibility(item)}
              onToggleFavorite={() => toggleFavorite(item)}
              onTransfer={() => startTransfer(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
