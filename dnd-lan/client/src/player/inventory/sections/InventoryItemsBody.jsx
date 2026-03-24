import React from "react";
import { EmptyState, Skeleton } from "../../../foundation/primitives/index.js";
import InventoryItemCard from "../../../components/vintage/InventoryItemCard.jsx";
import InventorySlotGrid from "../../InventorySlotGrid.jsx";

function InventoryEmptyState({ hasAny }) {
  return (
    <EmptyState
      title={hasAny ? "Ничего не найдено" : "Инвентарь пуст"}
      hint={hasAny ? "Попробуйте изменить фильтры или поиск." : "Добавьте предмет, чтобы начать."}
    />
  );
}

function InventoryLoadingState() {
  return (
    <div className="list">
      <div className="item"><Skeleton h={86} w="100%" /></div>
      <div className="item"><Skeleton h={86} w="100%" /></div>
      <div className="item"><Skeleton h={86} w="100%" /></div>
    </div>
  );
}

function InventoryListView({
  view,
  filtered,
  lite,
  listRef,
  readOnly,
  actionsVariant,
  startEdit,
  del,
  toggleVisibility,
  toggleFavorite,
  startTransfer,
}) {
  return (
    <div
      className={`list inv-shelf tf-item-list ${view === "grid" ? "inv-grid tf-item-grid" : ""}`.trim()}
      data-view={view}
      ref={lite ? null : listRef}
    >
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
  );
}

function InventorySlotsView({
  filtered,
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
}) {
  return (
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
  );
}

export default function InventoryItemsBody(props) {
  const {
    loading,
    view,
    filtered,
    hasAny,
  } = props;

  if (loading) {
    return <InventoryLoadingState />;
  }

  if (filtered.length === 0) {
    return <InventoryEmptyState hasAny={hasAny} />;
  }

  if (view === "slots") {
    return <InventorySlotsView {...props} />;
  }

  return <InventoryListView {...props} />;
}
