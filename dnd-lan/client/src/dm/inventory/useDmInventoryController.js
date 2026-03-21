import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api.js";
import { useToast } from "../../components/ui/ToastProvider.jsx";
import { useReadOnly } from "../../hooks/useReadOnly.js";
import { formatError } from "../../lib/formatError.js";
import {
  applyIconTag,
  getIconKeyFromItem,
  getInventoryIcon,
  stripIconTags
} from "../../lib/inventoryIcons.js";
import { useDebouncedValue } from "../../lib/useDebouncedValue.js";
import {
  EMPTY_INVENTORY_FORM,
  filterInventory,
  summarizeInventory
} from "../../player/inventoryDomain.js";
import { TRANSFER_REFRESH_MS, filterTransfers } from "./dmInventoryDomain.js";

export function useDmInventoryController() {
  const toast = useToast();
  const readOnly = useReadOnly();

  const [players, setPlayers] = useState([]);
  const [selectedId, setSelectedId] = useState(0);
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(EMPTY_INVENTORY_FORM);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [vis, setVis] = useState("");
  const [rarity, setRarity] = useState("");
  const [view, setView] = useState("list");
  const [autoAnimateRef] = useAutoAnimate({ duration: 200 });
  const debouncedQ = useDebouncedValue(q, 200);
  const [transferQ, setTransferQ] = useState("");
  const [transfers, setTransfers] = useState([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const listRef = useRef(null);

  const loadPlayers = useCallback(async () => {
    setErr("");
    try {
      const response = await api.dmPlayers();
      const nextPlayers = response.items || [];
      setPlayers(nextPlayers);
      if (!nextPlayers.length) {
        setSelectedId(0);
        setItems([]);
        setLoading(false);
      } else {
        setSelectedId((prev) => (prev ? prev : nextPlayers[0].id));
      }
    } catch (error) {
      setErr(formatError(error));
      setLoading(false);
    }
  }, []);

  const loadInv = useCallback(async (playerId) => {
    if (!playerId) return;
    setErr("");
    setLoading(true);
    try {
      const response = await api.invDmGetPlayer(playerId);
      setItems(response.items || []);
    } catch (error) {
      setErr(formatError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTransfers = useCallback(async () => {
    setTransfersLoading(true);
    try {
      const response = await api.invTransferDmList("pending");
      setTransfers(response.items || []);
    } catch {
      setTransfers([]);
    } finally {
      setTransfersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlayers().catch(() => {});
  }, [loadPlayers]);

  useEffect(() => {
    loadTransfers().catch(() => {});
  }, [loadTransfers]);

  useEffect(() => {
    const timerId = setInterval(() => {
      loadTransfers().catch(() => {});
    }, TRANSFER_REFRESH_MS);
    return () => clearInterval(timerId);
  }, [loadTransfers]);

  useEffect(() => {
    if (selectedId) loadInv(selectedId).catch(() => {});
  }, [loadInv, selectedId]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedId]);

  useEffect(() => {
    setSelectedIds((prev) => {
      if (!prev.size) return prev;
      const existing = new Set(items.map((item) => item.id));
      const next = new Set();
      for (const id of prev) {
        if (existing.has(id)) next.add(id);
      }
      return next;
    });
  }, [items]);

  const startAdd = useCallback(() => {
    if (readOnly) return;
    setEdit(null);
    setForm(EMPTY_INVENTORY_FORM);
    setOpen(true);
  }, [readOnly]);

  const startEdit = useCallback((item) => {
    if (readOnly) return;
    setEdit(item);
    const rest = { ...(item || {}) };
    delete rest.imageUrl;
    delete rest.image_url;
    delete rest.reservedQty;
    delete rest.reserved_qty;
    setForm({
      ...rest,
      tags: stripIconTags(item.tags || []),
      iconKey: getIconKeyFromItem(item)
    });
    setOpen(true);
  }, [readOnly]);

  const toggleSelect = useCallback((id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const save = useCallback(async () => {
    if (readOnly) return;
    setErr("");
    try {
      const { iconKey, ...rest } = form;
      const payload = {
        ...rest,
        qty: Number(rest.qty),
        weight: Number(rest.weight),
        tags: applyIconTag((rest.tags || []).filter(Boolean), iconKey)
      };
      if (edit) {
        await api.invDmUpdatePlayerItem(selectedId, edit.id, payload);
      } else {
        await api.invDmAddToPlayer(selectedId, payload);
      }
      setOpen(false);
      setForm(EMPTY_INVENTORY_FORM);
      setEdit(null);
      await loadInv(selectedId);
    } catch (error) {
      setErr(formatError(error));
    }
  }, [edit, form, loadInv, readOnly, selectedId]);

  const delItem = useCallback((item) => {
    if (readOnly || !item) return;
    setConfirmDialog({
      mode: "single",
      itemId: item.id,
      itemName: item.name || ""
    });
  }, [readOnly]);

  const toggleVisibility = useCallback(async (item) => {
    if (readOnly || !item) return;
    const nextVisibility = item.visibility === "hidden" ? "public" : "hidden";
    try {
      await api.invDmUpdatePlayerItem(selectedId, item.id, {
        ...item,
        visibility: nextVisibility,
        tags: item.tags || []
      });
      await loadInv(selectedId);
    } catch (error) {
      setErr(formatError(error));
    }
  }, [loadInv, readOnly, selectedId]);

  const filtered = useMemo(
    () => filterInventory(items, { q: debouncedQ, vis, rarity }),
    [debouncedQ, items, rarity, vis]
  );
  const { publicCount, hiddenCount } = useMemo(() => summarizeInventory(filtered), [filtered]);
  const { totalWeight: totalWeightAll } = useMemo(() => summarizeInventory(items), [items]);
  const hasAny = items.length > 0;
  const selectedCount = selectedIds.size;
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  const bulkHideSelected = useCallback(async () => {
    if (readOnly || !selectedId || selectedIds.size === 0) return;
    const targets = selectedItems.filter((item) => item.visibility !== "hidden");
    if (!targets.length) return;
    setErr("");
    try {
      await api.invDmBulkVisibility(selectedId, targets.map((item) => item.id), "hidden");
      await loadInv(selectedId);
      clearSelection();
    } catch (error) {
      setErr(formatError(error));
    }
  }, [clearSelection, loadInv, readOnly, selectedId, selectedIds.size, selectedItems]);

  const bulkDeleteSelected = useCallback(() => {
    if (readOnly || !selectedId || selectedIds.size === 0) return;
    const targets = selectedItems;
    if (!targets.length) return;
    setConfirmDialog({
      mode: "bulk",
      ids: targets.map((item) => item.id),
      count: targets.length
    });
  }, [readOnly, selectedId, selectedIds.size, selectedItems]);

  const confirmDelete = useCallback(async () => {
    if (readOnly || !confirmDialog || !selectedId) return;
    setErr("");
    setConfirmBusy(true);
    try {
      if (confirmDialog.mode === "single") {
        await api.invDmDeletePlayerItem(selectedId, confirmDialog.itemId);
      } else {
        await api.invDmBulkDelete(selectedId, confirmDialog.ids || []);
        clearSelection();
      }
      await loadInv(selectedId);
      setConfirmDialog(null);
    } catch (error) {
      setErr(formatError(error));
    } finally {
      setConfirmBusy(false);
    }
  }, [clearSelection, confirmDialog, loadInv, readOnly, selectedId]);

  const cancelTransfer = useCallback(async (transfer) => {
    if (readOnly || !transfer?.id) return;
    setErr("");
    try {
      const response = await api.invTransferDmCancel(transfer.id);
      if (response?.status === "expired") {
        await loadTransfers();
        toast.warn("Передача уже истекла");
        return;
      }
      await loadTransfers();
    } catch (error) {
      setErr(formatError(error));
    }
  }, [loadTransfers, readOnly, toast]);

  const filteredTransfers = useMemo(
    () => filterTransfers(transfers, transferQ),
    [transferQ, transfers]
  );
  const selectedIcon = getInventoryIcon(form.iconKey);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 180,
    overscan: 8
  });

  return {
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
    items,
    listRef,
    loadInv,
    loadPlayers,
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
  };
}
