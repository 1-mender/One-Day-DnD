import EmptyState from "../../../components/ui/EmptyState.jsx";
import Skeleton from "../../../components/ui/Skeleton.jsx";
import InventoryItemCard from "../../../components/vintage/InventoryItemCard.jsx";
import { t } from "../../../i18n/index.js";

export default function DMInventoryItemsSection({
  autoAnimateRef,
  delItem,
  filtered,
  hasAny,
  listRef,
  loading,
  readOnly,
  rowVirtualizer,
  selectedIds,
  startEdit,
  toggleSelect,
  toggleVisibility,
  view
}) {
  return (
    <div
      className={`list inv-shelf dm-inv-list tf-panel ${view === "grid" ? "inv-grid tf-item-grid" : "tf-item-list"}`}
      style={{ height: view === "list" ? "70vh" : undefined, overflow: view === "list" ? "auto" : undefined }}
      ref={view === "grid" ? autoAnimateRef : listRef}
    >
      {loading ? (
        <>
          <div className="item"><Skeleton h={86} w="100%" /></div>
          <div className="item"><Skeleton h={86} w="100%" /></div>
        </>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={hasAny ? t("dmInventory.notFoundTitle") : t("dmInventory.emptyTitle")}
          hint={hasAny ? t("dmInventory.notFoundHint") : t("dmInventory.emptyHint")}
        />
      ) : view === "list" ? (
        <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = filtered[virtualRow.index];
            return (
              <div
                key={item.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <InventoryItemCard
                  item={item}
                  readOnly={readOnly}
                  actionsVariant="stack"
                  onEdit={() => startEdit(item)}
                  onDelete={() => delItem(item)}
                  onToggleVisibility={() => toggleVisibility(item)}
                  selectable
                  selected={selectedIds.has(item.id)}
                  onSelectChange={(checked) => toggleSelect(item.id, checked)}
                />
              </div>
            );
          })}
        </div>
      ) : (
        filtered.map((item) => (
          <InventoryItemCard
            key={item.id}
            item={item}
            readOnly={readOnly}
            actionsVariant="compact"
            onEdit={() => startEdit(item)}
            onDelete={() => delItem(item)}
            onToggleVisibility={() => toggleVisibility(item)}
            selectable
            selected={selectedIds.has(item.id)}
            onSelectChange={(checked) => toggleSelect(item.id, checked)}
          />
        ))
      )}
    </div>
  );
}
