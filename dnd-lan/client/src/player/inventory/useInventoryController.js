import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../foundation/providers/index.js";
import { useQueryState } from "../../hooks/useQueryState.js";
import { useReadOnly } from "../../hooks/useReadOnly.js";
import { formatError } from "../../lib/formatError.js";
import {
  INVENTORY_ICON_SECTIONS,
  applyIconTag,
} from "../../lib/inventoryIcons.js";
import { api } from "../../api.js";
import {
  FAVORITE_TAG,
  applyLayoutMoves,
  filterIconSections,
  filterInventory,
  getItemAvailableQty,
  getSplitInputMax,
  summarizeInventory
} from "../inventoryDomain.js";
import { useInventoryData } from "./hooks/useInventoryData.js";
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

  function startTransfer(item) {
    if (readOnly) return;
    const available = getItemAvailableQty(item);
    if (available <= 0) {
      toast.warn("Нет доступного количества для передачи");
      return;
    }
    setTransferItem(item);
    setTransferQty(Math.min(available, 1));
    setTransferTo("");
    setTransferNote("");
    setTransferOpen(true);
    if (!players.length) loadPlayers().catch(() => {});
  }

  function startSplit(item, targetSlot = null) {
    if (readOnly) return;
    const available = getItemAvailableQty(item);
    if (available < 2) {
      toast.warn("Недостаточно количества для разделения");
      return;
    }
    setSplitItem(item);
    setSplitQty(1);
    setSplitTarget(
      targetSlot && Number.isInteger(targetSlot.slotX) && Number.isInteger(targetSlot.slotY)
        ? {
            container: String(targetSlot.container || "backpack"),
            slotX: Number(targetSlot.slotX),
            slotY: Number(targetSlot.slotY)
          }
        : null
    );
    setSplitOpen(true);
  }

  function handleGridSplitRequest(item, targetSlot, targetItem) {
    if (targetItem) {
      toast.warn("Для разделения нужен пустой слот");
      return;
    }
    startSplit(item, targetSlot);
  }

  async function save() {
    if (readOnly) return;
    setErr("");
    try {
      if (!form.name.trim()) return;
      const { iconKey, ...rest } = form;
      const payload = {
        ...rest,
        qty: Number(rest.qty),
        weight: Number(rest.weight),
        tags: applyIconTag((rest.tags || []).filter(Boolean), iconKey)
      };
      if (edit) await api.invUpdateMine(edit.id, payload);
      else await api.invAddMine(payload);
      setOpen(false);
      await load();
      toast.success("Сохранено");
    } catch (e) {
      const msg = formatError(e);
      setErr(msg);
      toast.error(msg);
    }
  }

  async function del(id) {
    if (readOnly) return;
    setErr("");
    try {
      await api.invDeleteMine(id);
      await load();
      toast.success("Удалено");
    } catch (e) {
      const msg = formatError(e);
      setErr(msg);
      toast.error(msg);
    }
  }

  async function sendTransfer() {
    if (readOnly || !transferItem) return;
    const qty = Number(transferQty);
    const available = getItemAvailableQty(transferItem);
    if (!Number.isFinite(qty) || qty < 1 || qty > 9999) {
      toast.error("Некорректное количество");
      return;
    }
    if (qty > available) {
      toast.error("Количество превышает доступное");
      return;
    }
    if (!transferTo) {
      toast.error("Выберите получателя");
      return;
    }
    if (String(transferNote || "").length > 140) {
      toast.error("Сообщение слишком длинное");
      return;
    }
    setErr("");
    try {
      await api.invTransferCreate({
        to_player_id: Number(transferTo),
        item_id: transferItem.id,
        qty,
        note: transferNote
      });
      setTransferOpen(false);
      await load();
      toast.success("Передача отправлена");
    } catch (e) {
      const msg = formatError(e);
      setErr(msg);
      toast.error(msg);
    }
  }

  async function toggleVisibility(item) {
    if (readOnly) return;
    try {
      const next = item.visibility === "hidden" ? "public" : "hidden";
      await api.invUpdateMine(item.id, { ...item, visibility: next, tags: item.tags || [] });
      toast.success(`Видимость: ${next === "public" ? "Публичный" : "Скрытый"}`);
      await load();
    } catch (e) {
      toast.error(formatError(e));
    }
  }

  async function toggleFavorite(item) {
    if (readOnly) return;
    try {
      const nextTags = Array.isArray(item.tags) ? [...item.tags] : [];
      const idx = nextTags.indexOf(FAVORITE_TAG);
      if (idx >= 0) nextTags.splice(idx, 1);
      else nextTags.push(FAVORITE_TAG);
      await api.invUpdateMine(item.id, { ...item, tags: nextTags });
      toast.success(idx >= 0 ? "Убрано из избранного" : "Добавлено в избранное");
      await load();
    } catch (e) {
      toast.error(formatError(e));
    }
  }

  async function moveLayoutItems(moves) {
    if (readOnly || !Array.isArray(moves) || !moves.length) return;
    const snapshot = items;
    setLayoutSaving(true);
    setItems((current) => applyLayoutMoves(current, moves));
    try {
      await api.invLayoutUpdateMine(moves);
    } catch (e) {
      setItems(snapshot);
      const msg = formatError(e);
      setErr(msg);
      toast.error(msg);
      await load();
    } finally {
      setLayoutSaving(false);
    }
  }

  async function quickEquip(item) {
    if (readOnly || !item?.id) return;
    setErr("");
    try {
      const result = await api.invQuickEquipMine(item.id);
      if (result?.idempotent) toast.info("Уже экипировано");
      else toast.success("Экипировано");
      await load();
    } catch (e) {
      const msg = formatError(e);
      setErr(msg);
      toast.error(msg);
    }
  }

  async function confirmSplit() {
    if (readOnly || !splitItem) return;
    const available = getItemAvailableQty(splitItem);
    const qty = Math.floor(Number(splitQty));
    if (!Number.isFinite(qty) || qty < 1 || qty >= available) {
      toast.error("Некорректное количество для разделения");
      return;
    }
    setErr("");
    try {
      const payload = { qty };
      if (splitTarget && Number.isInteger(splitTarget.slotX) && Number.isInteger(splitTarget.slotY)) {
        payload.container = splitTarget.container;
        payload.slotX = splitTarget.slotX;
        payload.slotY = splitTarget.slotY;
      }
      await api.invSplitMine(splitItem.id, payload);
      setSplitOpen(false);
      setSplitItem(null);
      setSplitTarget(null);
      await load();
      toast.success("Стак разделен");
    } catch (e) {
      const msg = formatError(e);
      setErr(msg);
      toast.error(msg);
    }
  }

  const hasWeightLimit = Number.isFinite(maxWeight) && maxWeight > 0;
  const weightRatio = hasWeightLimit ? totalWeightAll / maxWeight : 0;
  const weightStatus = hasWeightLimit ? (weightRatio >= 1 ? "off" : weightRatio >= 0.75 ? "warn" : "ok") : "secondary";
  const transferAvailable = transferItem ? getItemAvailableQty(transferItem) : 0;
  const transferInputMax = Math.max(1, Math.min(9999, transferAvailable || 1));
  const splitAvailable = splitItem ? getItemAvailableQty(splitItem) : 0;

  function closeTransfer() {
    setTransferOpen(false);
  }

  function closeSplit() {
    setSplitOpen(false);
    setSplitItem(null);
    setSplitTarget(null);
  }

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
    closeEditor,
    closeTransfer,
    closeSplit
  };
}
