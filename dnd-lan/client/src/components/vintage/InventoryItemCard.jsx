import React, { memo, useId, useMemo, useState } from "react";
import { stripIconTags } from "../../lib/inventoryIcons.js";
import { getRarityLabel } from "../../lib/inventoryRarity.js";
import InventoryItemActions from "./inventoryItemCard/InventoryItemActions.jsx";
import InventoryItemDescription from "./inventoryItemCard/InventoryItemDescription.jsx";
import InventoryItemHeader from "./inventoryItemCard/InventoryItemHeader.jsx";
import InventoryItemMobileActions from "./inventoryItemCard/InventoryItemMobileActions.jsx";
import { toPlainText, truncateText } from "./inventoryItemCard/descriptionDomain.js";
import { pickInventoryIcon } from "./inventoryItemCard/iconDomain.js";
import { useInventoryItemInteractions } from "./inventoryItemCard/useInventoryItemInteractions.js";

function InventoryItemCard({
  item,
  readOnly,
  onEdit,
  onDelete,
  onToggleVisibility,
  onToggleFavorite,
  actionsVariant = "stack",
  lite = false,
  selectable = false,
  selected = false,
  onSelectChange,
  onInspect,
  onTransfer
}) {
  const actionsId = useId();
  const descId = useId();
  const icon = pickInventoryIcon(item);
  const isHidden = item.visibility === "hidden";
  const vis = isHidden ? "Скрытый" : "Публичный";
  const hasActions = !!onEdit || !!onDelete || !!onToggleVisibility || !!onToggleFavorite || !!onTransfer;
  const weight = Number(item.weight || 0);
  const rarityKey = String(item.rarity || "common").toLowerCase().replace(/\s+/g, "_");
  const rarityLabel = getRarityLabel(rarityKey);
  const tags = stripIconTags(Array.isArray(item.tags) ? item.tags.filter(Boolean) : []);
  const isFavorite = tags.includes("favorite");
  const compact = actionsVariant === "compact";
  const reservedQty = Number(item.reservedQty ?? item.reserved_qty ?? 0);
  const totalQty = Number(item.qty || 0);
  const availableQty = Math.max(0, totalQty - reservedQty);
  const transferDisabled = readOnly || availableQty <= 0;
  const [expanded, setExpanded] = useState(false);
  const {
    isMobile,
    quickOpen,
    setQuickOpen,
    showHint,
    hapticTap,
    interactionHandlers,
  } = useInventoryItemInteractions({
    itemId: item.id,
    hasActions,
    onToggleFavorite,
    readOnly,
  });
  const descPlain = useMemo(() => toPlainText(item.description), [item.description]);
  const descPreview = useMemo(() => truncateText(descPlain, 180), [descPlain]);
  const hasLongDesc = !lite && descPlain.length > 180;
  const showFullDesc = !lite && (!hasLongDesc || expanded);
  const showDesc = !!item.description && descPlain.length > (isMobile ? 6 : 0);
  const showActions = hasActions && (!isMobile && (!(compact || lite) || quickOpen));
  const actionsLabel = item.name ? `Действия: ${item.name}` : "Действия предмета";

  return (
    <div
      className="item taped inv-card tf-item-card"
      data-rarity={rarityKey}
      data-visibility={item.visibility}
      data-favorite={isFavorite ? "true" : "false"}
      data-selected={selected ? "true" : "false"}
      data-actions-open={quickOpen ? "true" : "false"}
      data-swipe-hint={showHint ? "true" : "false"}
      data-variant={actionsVariant}
      data-lite={lite ? "true" : "false"}
      style={{ contentVisibility: "auto", containIntrinsicSize: "180px" }}
      {...interactionHandlers}
      onContextMenu={(event) => {
        if (!hasActions) return;
        event.preventDefault();
        setQuickOpen((prev) => !prev);
      }}
    >
      {selectable ? (
        <label className="inv-select">
          <input
            type="checkbox"
            checked={!!selected}
            onChange={(e) => onSelectChange?.(e.target.checked)}
            aria-label={"\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u043f\u0440\u0435\u0434\u043c\u0435\u0442"}
            disabled={readOnly}
          />
        </label>
      ) : null}
      <InventoryItemHeader
        itemName={item.name}
        icon={icon}
        quickOpen={quickOpen}
        setQuickOpen={setQuickOpen}
        hapticTap={hapticTap}
        hasActions={hasActions}
        showActions={showActions}
        actionsId={actionsId}
        isMobile={isMobile}
        qty={item.qty}
        isHidden={isHidden}
        visibilityLabel={vis}
        weight={weight}
        rarityKey={rarityKey}
        rarityLabel={rarityLabel}
        reservedQty={reservedQty}
        availableQty={availableQty}
        lite={lite}
        tags={tags}
        updatedBy={item.updated_by}
      />

      {showDesc ? (
        <InventoryItemDescription
          lite={lite}
          descId={descId}
          showFullDesc={showFullDesc}
          description={item.description}
          descPreview={descPreview}
          hasLongDesc={hasLongDesc}
          expanded={expanded}
          setExpanded={setExpanded}
        />
      ) : null}

      {showActions ? (
        <InventoryItemActions
          actionsId={actionsId}
          actionsLabel={actionsLabel}
          compact={compact}
          readOnly={readOnly}
          isFavorite={isFavorite}
          isHidden={isHidden}
          transferDisabled={transferDisabled}
          onToggleFavorite={onToggleFavorite}
          onInspect={onInspect}
          onEdit={onEdit}
          onTransfer={onTransfer}
          onToggleVisibility={onToggleVisibility}
          onDelete={onDelete}
        />
      ) : null}
      {isMobile && hasActions ? (
        <InventoryItemMobileActions
          itemName={item.name}
          quickOpen={quickOpen}
          setQuickOpen={setQuickOpen}
          readOnly={readOnly}
          isFavorite={isFavorite}
          isHidden={isHidden}
          transferDisabled={transferDisabled}
          onToggleFavorite={onToggleFavorite}
          onInspect={onInspect}
          onEdit={onEdit}
          onTransfer={onTransfer}
          onToggleVisibility={onToggleVisibility}
          onDelete={onDelete}
        />
      ) : null}
    </div>
  );
}

export default memo(InventoryItemCard);





