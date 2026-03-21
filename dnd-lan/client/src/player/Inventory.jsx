import React from "react";
import { useNavigate } from "react-router-dom";
import { RARITY_OPTIONS } from "../lib/inventoryRarity.js";
import { useInventoryController } from "./inventory/useInventoryController.js";
import InventoryFavoritesSection from "./inventory/sections/InventoryFavoritesSection.jsx";
import InventoryItemModal from "./inventory/sections/InventoryItemModal.jsx";
import InventoryItemsSection from "./inventory/sections/InventoryItemsSection.jsx";
import InventorySplitModal from "./inventory/sections/InventorySplitModal.jsx";
import InventoryStatsSection from "./inventory/sections/InventoryStatsSection.jsx";
import InventoryToolbarSection from "./inventory/sections/InventoryToolbarSection.jsx";
import InventoryTransferModal from "./inventory/sections/InventoryTransferModal.jsx";

export default function Inventory() {
  const nav = useNavigate();
  const {
    q,
    setQ,
    vis,
    setVis,
    rarity,
    setRarity,
    view,
    setView,
    items,
    players,
    maxWeight,
    open,
    setOpen,
    edit,
    form,
    setForm,
    transferOpen,
    setTransferOpen,
    transferItem,
    transferTo,
    setTransferTo,
    transferQty,
    setTransferQty,
    transferNote,
    setTransferNote,
    splitOpen,
    splitItem,
    splitQty,
    setSplitQty,
    splitTarget,
    err,
    loading,
    lite,
    isNarrowScreen,
    listRef,
    iconQuery,
    setIconQuery,
    iconPickerOpen,
    setIconPickerOpen,
    layoutSaving,
    mobileStatsOpen,
    setMobileStatsOpen,
    mobileFavoritesOpen,
    setMobileFavoritesOpen,
    readOnly,
    actionsVariant,
    load,
    filtered,
    totalWeight,
    publicCount,
    hiddenCount,
    totalWeightAll,
    favorites,
    filteredIconSections,
    hasAny,
    SelectedIcon,
    startAdd,
    startEdit,
    startTransfer,
    startSplit,
    handleGridSplitRequest,
    save,
    del,
    sendTransfer,
    toggleVisibility,
    toggleFavorite,
    moveLayoutItems,
    quickEquip,
    confirmSplit,
    hasWeightLimit,
    weightStatus,
    transferAvailable,
    transferInputMax,
    splitAvailable,
    closeEditor,
    closeTransfer,
    closeSplit
  } = useInventoryController();

  const openTransfers = () => nav("/app/transfers");

  return (
    <div className={`card inventory-shell${lite ? " page-lite" : ""}`.trim()}>
      <InventoryToolbarSection
        isNarrowScreen={isNarrowScreen}
        totalWeight={totalWeight}
        readOnly={readOnly}
        onOpenTransfers={openTransfers}
        onStartAdd={startAdd}
        onRefresh={load}
        q={q}
        setQ={setQ}
        view={view}
        setView={setView}
        vis={vis}
        setVis={setVis}
        rarity={rarity}
        setRarity={setRarity}
        rarityOptions={RARITY_OPTIONS}
      />

      <InventoryStatsSection
        isNarrowScreen={isNarrowScreen}
        mobileStatsOpen={mobileStatsOpen}
        setMobileStatsOpen={setMobileStatsOpen}
        filteredCount={filtered.length}
        publicCount={publicCount}
        hiddenCount={hiddenCount}
        weightStatus={weightStatus}
        totalWeightAll={totalWeightAll}
        hasWeightLimit={hasWeightLimit}
        maxWeight={maxWeight}
      />

      <InventoryFavoritesSection
        isNarrowScreen={isNarrowScreen}
        mobileFavoritesOpen={mobileFavoritesOpen}
        setMobileFavoritesOpen={setMobileFavoritesOpen}
        favorites={favorites}
        startEdit={startEdit}
        readOnly={readOnly}
      />

      <InventoryItemsSection
        err={err}
        load={load}
        loading={loading}
        view={view}
        filtered={filtered}
        hasAny={hasAny}
        readOnly={readOnly}
        layoutSaving={layoutSaving}
        isNarrowScreen={isNarrowScreen}
        moveLayoutItems={moveLayoutItems}
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

      <InventoryItemModal
        open={open}
        edit={edit}
        closeEditor={closeEditor}
        form={form}
        setForm={setForm}
        selectedIcon={SelectedIcon}
        iconPickerOpen={iconPickerOpen}
        setIconPickerOpen={setIconPickerOpen}
        iconQuery={iconQuery}
        setIconQuery={setIconQuery}
        filteredIconSections={filteredIconSections}
        save={save}
      />

      <InventoryTransferModal
        transferOpen={transferOpen}
        closeTransfer={closeTransfer}
        transferItem={transferItem}
        transferAvailable={transferAvailable}
        transferTo={transferTo}
        setTransferTo={setTransferTo}
        players={players}
        transferInputMax={transferInputMax}
        transferQty={transferQty}
        setTransferQty={setTransferQty}
        transferNote={transferNote}
        setTransferNote={setTransferNote}
        sendTransfer={sendTransfer}
      />

      <InventorySplitModal
        splitOpen={splitOpen}
        closeSplit={closeSplit}
        splitItem={splitItem}
        splitAvailable={splitAvailable}
        splitTarget={splitTarget}
        splitQty={splitQty}
        setSplitQty={setSplitQty}
        confirmSplit={confirmSplit}
      />
    </div>
  );
}
