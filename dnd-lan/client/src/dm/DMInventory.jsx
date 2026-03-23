import React from "react";
import { RARITY_OPTIONS } from "../lib/inventoryRarity.js";
import { INVENTORY_ICON_SECTIONS } from "../lib/inventoryIcons.js";
import { t } from "../i18n/index.js";
import { ConfirmDialog, ErrorBanner, PageHeader, StatusBanner } from "../foundation/primitives/index.js";
import DMInventoryBulkActionsSection from "./inventory/sections/DMInventoryBulkActionsSection.jsx";
import DMInventoryFiltersSection from "./inventory/sections/DMInventoryFiltersSection.jsx";
import DMInventoryItemModal from "./inventory/sections/DMInventoryItemModal.jsx";
import DMInventoryItemsSection from "./inventory/sections/DMInventoryItemsSection.jsx";
import DMInventoryToolbarSection from "./inventory/sections/DMInventoryToolbarSection.jsx";
import DMInventoryTransfersSection from "./inventory/sections/DMInventoryTransfersSection.jsx";
import { useDmInventoryController } from "./inventory/useDmInventoryController.js";

export default function DMInventory() {
  const controller = useDmInventoryController();
  const {
    autoAnimateRef,
    bulkDeleteSelected,
    bulkHideSelected,
    cancelTransfer,
    clearSelection,
    confirmBusy,
    confirmDelete,
    confirmDialog,
    delItem,
    edit,
    err,
    filtered,
    filteredTransfers,
    form,
    hasAny,
    hiddenCount,
    listRef,
    loadInv,
    loadTransfers,
    loading,
    open,
    players,
    publicCount,
    q,
    rarity,
    readOnly,
    rowVirtualizer,
    save,
    selectedCount,
    selectedIcon,
    selectedId,
    selectedIds,
    setConfirmDialog,
    setForm,
    setOpen,
    setQ,
    setRarity,
    setSelectedId,
    setTransferQ,
    setView,
    setVis,
    startAdd,
    startEdit,
    toggleSelect,
    toggleVisibility,
    totalWeightAll,
    transferQ,
    transfers,
    transfersLoading,
    view,
    vis
  } = controller;

  return (
    <div className="card dm-inv-shell tf-shell tf-dm-inv-shell" data-has-selection={selectedCount > 0 ? "true" : "false"}>
      <PageHeader title={t("dmInventory.title")} subtitle={t("dmInventory.subtitle")} />
      <hr />
      <ErrorBanner message={err} onRetry={() => loadInv(selectedId)} />
      {readOnly ? <StatusBanner tone="warning">{t("dmInventory.readOnly")}</StatusBanner> : null}

      <div className="dm-inv-panels">
        <DMInventoryToolbarSection
          players={players}
          readOnly={readOnly}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          startAdd={startAdd}
          refresh={() => loadInv(selectedId)}
        />
        <DMInventoryFiltersSection
          filteredCount={filtered.length}
          hiddenCount={hiddenCount}
          q={q}
          rarity={rarity}
          rarityOptions={RARITY_OPTIONS}
          setQ={setQ}
          setRarity={setRarity}
          setView={setView}
          setVis={setVis}
          totalWeightAll={totalWeightAll}
          publicCount={publicCount}
          view={view}
          vis={vis}
        />
        <DMInventoryBulkActionsSection
          bulkDeleteSelected={bulkDeleteSelected}
          bulkHideSelected={bulkHideSelected}
          clearSelection={clearSelection}
          readOnly={readOnly}
          selectedCount={selectedCount}
          selectedId={selectedId}
        />
      </div>

      <DMInventoryTransfersSection
        cancelTransfer={cancelTransfer}
        filteredTransfers={filteredTransfers}
        loadTransfers={loadTransfers}
        readOnly={readOnly}
        transferQ={transferQ}
        setTransferQ={setTransferQ}
        transfers={transfers}
        transfersLoading={transfersLoading}
      />

      <DMInventoryItemsSection
        autoAnimateRef={autoAnimateRef}
        delItem={delItem}
        filtered={filtered}
        hasAny={hasAny}
        listRef={listRef}
        loading={loading}
        readOnly={readOnly}
        rowVirtualizer={rowVirtualizer}
        selectedIds={selectedIds}
        startEdit={startEdit}
        toggleSelect={toggleSelect}
        toggleVisibility={toggleVisibility}
        view={view}
      />

      <DMInventoryItemModal
        edit={edit}
        form={form}
        iconSections={INVENTORY_ICON_SECTIONS}
        open={open}
        readOnly={readOnly}
        save={save}
        selectedIcon={selectedIcon}
        setForm={setForm}
        setOpen={setOpen}
        rarityOptions={RARITY_OPTIONS}
      />

      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.mode === "single" ? t("dmInventory.confirmSingleTitle") : t("dmInventory.confirmBulkTitle")}
        message={confirmDialog?.mode === "single"
          ? t("dmInventory.confirmSingleBody", { name: confirmDialog?.itemName || t("dmInventory.noName") })
          : t("dmInventory.confirmBulkBody", { count: confirmDialog?.count || 0 })}
        onCancel={() => {
          if (!confirmBusy) setConfirmDialog(null);
        }}
        onConfirm={confirmDelete}
        confirmDisabled={readOnly || confirmBusy}
        cancelLabel={t("common.cancel")}
        confirmLabel={confirmBusy ? t("dmInventory.deleting") : t("dmInventory.bulkDelete")}
      />
    </div>
  );
}
