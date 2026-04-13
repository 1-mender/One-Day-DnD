import React from "react";
import VirtualizedStack from "../../../components/VirtualizedStack.jsx";
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
  startInspect,
  startEdit,
  del,
  toggleVisibility,
  toggleFavorite,
  startTransfer,
}) {
  return (
    <VirtualizedStack
      className={`list inv-shelf tf-item-list ${view === "grid" ? "inv-grid tf-item-grid" : ""}`.trim()}
      containerStyle={{ minHeight: 280 }}
      estimateSize={132}
      items={filtered}
      maxHeight={760}
      minHeight={280}
      rowGap={12}
      staticListRef={lite ? null : listRef}
      staticThreshold={view === "list" ? 20 : Number.MAX_SAFE_INTEGER}
      getItemKey={(item) => item.id}
      renderItem={(item) => (
        <InventoryItemCard
          item={item}
          readOnly={readOnly}
          actionsVariant={actionsVariant}
          lite={lite}
          onInspect={() => startInspect(item)}
          onEdit={() => startEdit(item)}
          onDelete={() => del(item.id)}
          onToggleVisibility={() => toggleVisibility(item)}
          onToggleFavorite={() => toggleFavorite(item)}
          onTransfer={() => startTransfer(item)}
        />
      )}
    />
  );
}

function InventorySlotsView({
  filtered,
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
}) {
  return (
    <InventorySlotGrid
      items={filtered}
      readOnly={readOnly}
      busy={layoutSaving}
      touchOptimized={isNarrowScreen}
      onMove={moveLayoutItems}
      onItemOpen={(item) => startInspect(item)}
      onItemEdit={(item) => startEdit(item)}
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
