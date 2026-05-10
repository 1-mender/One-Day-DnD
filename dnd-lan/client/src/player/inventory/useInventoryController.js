import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../foundation/providers/index.js";
import { useQueryState } from "../../hooks/useQueryState.js";
import { useReadOnly } from "../../hooks/useReadOnly.js";
import {
  INVENTORY_ICON_SECTIONS,
} from "../../lib/inventoryIcons.js";
import {
  FAVORITE_TAG,
  filterIconSections,
  filterInventory,
  getItemAvailableQty,
  getSplitInputMax,
  summarizeInventory
} from "../inventoryDomain.js";
import { useInventoryData } from "./hooks/useInventoryData.js";
import { useInventoryActions } from "./hooks/useInventoryActions.js";
import { useInventoryEditorState } from "./hooks/useInventoryEditorState.js";
import { useInventoryResponsiveState } from "./hooks/useInventoryResponsiveState.js";

export function useInventoryController() {
  const toast = useToast();

  const [q, setQ] = useQueryState("q", "");
  const [vis, setVis] = useQueryState("vis", "");
  const [rarity, setRarity] = useQueryState("rarity", "");
  const [view, setView] = useQueryState("view", "list");
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferItem, setTransferItem] = useState(null);
  const [transferTo, setTransferTo] = useState("");
  const [transferQty, setTransferQty] = useState(1);
  const [transferNote, setTransferNote] = useState("");
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitItem, setSplitItem] = useState(null);
  const [splitQty, setSplitQty] = useState(1);
  const [splitTarget, setSplitTarget] = useState(null);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectItem, setInspectItem] = useState(null);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const readOnly = useReadOnly();
  const {
    items,
    setItems,
    players,
    maxWeight,
    err,
    setErr,
    loading,
    load,
    loadPlayers,
  } = useInventoryData();
  const {
    open,
    setOpen,
    edit,
    form,
    setForm,
    iconQuery,
    setIconQuery,
    iconPickerOpen,
    setIconPickerOpen,
    SelectedIcon,
    startAdd: startEditorAdd,
    startEdit: startEditorEdit,
    closeEditor,
  } = useInventoryEditorState();
  const {
    lite,
    isNarrowScreen,
    listRef,
    mobileStatsOpen,
    setMobileStatsOpen,
    mobileFavoritesOpen,
    setMobileFavoritesOpen,
  } = useInventoryResponsiveState(view, setView);
  const {
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
    closeTransfer,
    closeSplit,
  } = useInventoryActions({
    readOnly,
    toast,
    players,
    items,
    setItems,
    load,
    loadPlayers,
    form,
    edit,
    closeEditor,
    setErr,
    transferItem,
    transferTo,
    transferQty,
    transferNote,
    setTransferOpen,
    setTransferItem,
    setTransferTo,
    setTransferQty,
    setTransferNote,
    splitItem,
    splitQty,
    splitTarget,
    setSplitOpen,
    setSplitItem,
    setSplitQty,
    setSplitTarget,
    layoutSaving,
    setLayoutSaving,
  });
  const actionsVariant = lite || view === "grid" ? "compact" : "stack";

  useEffect(() => {
    if (transferOpen && !transferTo && players.length) {
      setTransferTo(String(players[0].id));
    }
  }, [transferOpen, transferTo, players]);

  const filtered = useMemo(() => filterInventory(items, { q, vis, rarity }), [items, q, vis, rarity]);
  const { totalWeight, publicCount, hiddenCount } = useMemo(() => summarizeInventory(filtered), [filtered]);
  const { totalWeight: totalWeightAll } = useMemo(() => summarizeInventory(items), [items]);
  const favorites = useMemo(
    () => items.filter((item) => Array.isArray(item.tags) && item.tags.includes(FAVORITE_TAG)),
    [items]
  );
  const filteredIconSections = useMemo(
    () => filterIconSections(INVENTORY_ICON_SECTIONS, iconQuery),
    [iconQuery]
  );
  const hasAny = items.length > 0;

  function startAdd() {
    if (readOnly) return;
    startEditorAdd();
  }

  function startEdit(item) {
    if (readOnly) return;
    startEditorEdit(item);
  }

  function startInspect(item) {
    if (!item) return;
    setInspectItem(item);
    setInspectOpen(true);
  }

  function closeInspect() {
    setInspectOpen(false);
    setInspectItem(null);
  }

  const hasWeightLimit = Number.isFinite(maxWeight) && maxWeight > 0;
  const weightRatio = hasWeightLimit ? totalWeightAll / maxWeight : 0;
  const weightStatus = hasWeightLimit ? (weightRatio >= 1 ? "off" : weightRatio >= 0.75 ? "warn" : "ok") : "secondary";
  const transferAvailable = transferItem ? getItemAvailableQty(transferItem) : 0;
  const transferInputMax = Math.max(1, Math.min(9999, transferAvailable || 1));
  const splitAvailable = splitItem ? getItemAvailableQty(splitItem) : 0;

  return {
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
    inspectOpen,
    setInspectOpen,
    inspectItem,
    setInspectItem,
    splitOpen,
    setSplitOpen,
    splitItem,
    setSplitItem,
    splitQty,
    setSplitQty,
    splitTarget,
    setSplitTarget,
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
    startInspect,
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
    weightRatio,
    weightStatus,
    transferAvailable,
    transferInputMax,
    splitAvailable,
    getSplitInputMax,
    closeInspect,
    closeEditor,
    closeTransfer,
    closeSplit
  };
}
