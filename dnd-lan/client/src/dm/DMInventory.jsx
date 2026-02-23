import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";
import InventoryItemCard from "../components/vintage/InventoryItemCard.jsx";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Eye, EyeOff, LayoutGrid, List, Package, Plus, RefreshCcw, Scale, Trash2 } from "lucide-react";
import ErrorBanner from "../components/ui/ErrorBanner.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { useReadOnly } from "../hooks/useReadOnly.js";
import { formatError } from "../lib/formatError.js";
import {
  INVENTORY_ICON_SECTIONS,
  applyIconTag,
  getIconKeyFromItem,
  getInventoryIcon,
  stripIconTags
} from "../lib/inventoryIcons.js";
import { RARITY_OPTIONS } from "../lib/inventoryRarity.js";
import { useDebouncedValue } from "../lib/useDebouncedValue.js";
import { useVirtualizer } from "@tanstack/react-virtual";
import { t } from "../i18n/index.js";
import { ConfirmDialog, FilterBar, PageHeader, SectionCard, StatusBanner } from "../foundation/primitives/index.js";

const empty = { name: "", description: "", qty: 1, weight: 0, rarity: "common", tags: [], visibility: "public", iconKey: "" };
const TRANSFER_REFRESH_MS = 30_000;

export default function DMInventory() {
  const toast = useToast();
  const readOnly = useReadOnly();
  const [players, setPlayers] = useState([]);
  const [selectedId, setSelectedId] = useState(0);
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(empty);
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

  const loadPlayers = useCallback(async () => {
    setErr("");
    try {
      const response = await api.dmPlayers();
      const list = response.items || [];
      setPlayers(list);
      if (!list.length) {
        setSelectedId(0);
        setItems([]);
        setLoading(false);
      } else {
        setSelectedId((prev) => (prev ? prev : list[0].id));
      }
    } catch (error) {
      setErr(formatError(error));
      setLoading(false);
    }
  }, []);

  async function loadInv(pid) {
    if (!pid) return;
    setErr("");
    setLoading(true);
    try {
      const response = await api.invDmGetPlayer(pid);
      setItems(response.items || []);
    } catch (error) {
      setErr(formatError(error));
    } finally {
      setLoading(false);
    }
  }

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
    const id = setInterval(() => {
      loadTransfers().catch(() => {});
    }, TRANSFER_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadTransfers]);

  useEffect(() => {
    if (selectedId) loadInv(selectedId).catch(() => {});
  }, [selectedId]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedId]);

  useEffect(() => {
    setSelectedIds((prev) => {
      if (!prev.size) return prev;
      const existing = new Set(items.map((it) => it.id));
      const next = new Set();
      for (const id of prev) if (existing.has(id)) next.add(id);
      return next;
    });
  }, [items]);

  function startAdd() {
    if (readOnly) return;
    setEdit(null);
    setForm(empty);
    setOpen(true);
  }

  function startEdit(item) {
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
  }

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

  async function save() {
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
      setForm(empty);
      setEdit(null);
      await loadInv(selectedId);
    } catch (error) {
      setErr(formatError(error));
    }
  }

  function delItem(item) {
    if (readOnly || !item) return;
    setConfirmDialog({
      mode: "single",
      itemId: item.id,
      itemName: item.name || ""
    });
  }

  async function toggleVisibility(item) {
    if (readOnly || !item) return;
    const next = item.visibility === "hidden" ? "public" : "hidden";
    try {
      await api.invDmUpdatePlayerItem(selectedId, item.id, { ...item, visibility: next, tags: item.tags || [] });
      await loadInv(selectedId);
    } catch (error) {
      setErr(formatError(error));
    }
  }

  async function bulkHideSelected() {
    if (readOnly) return;
    if (!selectedId || selectedIds.size === 0) return;
    const targets = selectedItems.filter((it) => it.visibility !== "hidden");
    if (!targets.length) return;
    setErr("");
    try {
      await api.invDmBulkVisibility(selectedId, targets.map((it) => it.id), "hidden");
      await loadInv(selectedId);
      clearSelection();
    } catch (error) {
      setErr(formatError(error));
    }
  }

  function bulkDeleteSelected() {
    if (readOnly) return;
    if (!selectedId || selectedIds.size === 0) return;
    const targets = selectedItems;
    if (!targets.length) return;
    setConfirmDialog({
      mode: "bulk",
      ids: targets.map((it) => it.id),
      count: targets.length
    });
  }

  async function confirmDelete() {
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
  }

  async function cancelTransfer(tr) {
    if (readOnly || !tr?.id) return;
    setErr("");
    try {
      const response = await api.invTransferDmCancel(tr.id);
      if (response?.status === "expired") {
        await loadTransfers();
        toast.warn(t("dmInventory.transferExpired"));
        return;
      }
      await loadTransfers();
    } catch (error) {
      setErr(formatError(error));
    }
  }

  const filtered = useMemo(() => filterInventory(items, { q: debouncedQ, vis, rarity }), [items, debouncedQ, vis, rarity]);
  const { publicCount, hiddenCount } = useMemo(() => summarizeInventory(filtered), [filtered]);
  const { totalWeight: totalWeightAll } = useMemo(() => summarizeInventory(items), [items]);
  const hasAny = items.length > 0;
  const selectedCount = selectedIds.size;
  const selectedItems = useMemo(() => items.filter((it) => selectedIds.has(it.id)), [items, selectedIds]);
  const filteredTransfers = useMemo(() => filterTransfers(transfers, transferQ), [transfers, transferQ]);
  const SelectedIcon = getInventoryIcon(form.iconKey);
  const listRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 180,
    overscan: 8
  });

  return (
    <div className="card taped">
      <PageHeader
        title={t("dmInventory.title")}
        subtitle={t("dmInventory.subtitle")}
      />
      <hr />
      <ErrorBanner message={err} onRetry={() => loadInv(selectedId)} />
      {readOnly ? <StatusBanner tone="warning">{t("dmInventory.readOnly")}</StatusBanner> : null}

      <FilterBar className="inv-toolbar">
        <select value={selectedId} onChange={(e) => setSelectedId(Number(e.target.value))} className="u-w-full">
          {players.map((p) => <option key={p.id} value={p.id}>{t("dmInventory.playerOption", { name: p.displayName, id: p.id })}</option>)}
        </select>
        <button className="btn" onClick={startAdd} disabled={readOnly || !selectedId}><Plus className="icon" aria-hidden="true" />{t("dmInventory.issue")}</button>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("dmInventory.searchPlaceholder")} className="u-w-min-360" />
        <select value={vis} onChange={(e) => setVis(e.target.value)} className="u-w-180">
          <option value="">{t("dmInventory.visibilityAll")}</option>
          <option value="public">{t("dmInventory.visibilityPublic")}</option>
          <option value="hidden">{t("dmInventory.visibilityHidden")}</option>
        </select>
        <select value={rarity} onChange={(e) => setRarity(e.target.value)} className="u-w-180">
          <option value="">{t("dmInventory.rarityAll")}</option>
          {RARITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button className={`btn ${view === "list" ? "" : "secondary"}`} onClick={() => setView("list")}>
          <List className="icon" aria-hidden="true" />{t("dmInventory.viewList")}
        </button>
        <button className={`btn ${view === "grid" ? "" : "secondary"}`} onClick={() => setView("grid")}>
          <LayoutGrid className="icon" aria-hidden="true" />{t("dmInventory.viewGrid")}
        </button>
        <button className="btn secondary" onClick={() => loadInv(selectedId)} disabled={!selectedId}>
          <RefreshCcw className="icon" aria-hidden="true" />{t("dmInventory.refresh")}
        </button>
        <span className="badge secondary">{t("dmInventory.selectedCount", { count: selectedCount })}</span>
        <button
          className="btn secondary"
          onClick={bulkHideSelected}
          disabled={readOnly || !selectedId || selectedCount === 0}
          title={t("dmInventory.bulkHideTitle")}
        >
          <EyeOff className="icon" aria-hidden="true" />
          {t("dmInventory.bulkHide")}
        </button>
        <button
          className="btn danger"
          onClick={bulkDeleteSelected}
          disabled={readOnly || !selectedId || selectedCount === 0}
          title={t("dmInventory.bulkDeleteTitle")}
        >
          <Trash2 className="icon" aria-hidden="true" />
          {t("dmInventory.bulkDelete")}
        </button>
        {selectedCount > 0 ? (
          <button className="btn secondary" onClick={clearSelection}>
            {t("dmInventory.clearSelection")}
          </button>
        ) : null}
      </FilterBar>

      <div className="small u-mt-10">
        <div className="row u-row-wrap">
          <span className="badge"><Package className="icon" aria-hidden="true" />{t("dmInventory.totalItems", { count: filtered.length })}</span>
          <span className="badge ok"><Eye className="icon" aria-hidden="true" />{t("dmInventory.totalPublic", { count: publicCount })}</span>
          <span className="badge off"><EyeOff className="icon" aria-hidden="true" />{t("dmInventory.totalHidden", { count: hiddenCount })}</span>
          <span className="badge secondary"><Scale className="icon" aria-hidden="true" />{t("dmInventory.totalWeight", { value: totalWeightAll.toFixed(2) })}</span>
        </div>
      </div>

      <SectionCard
        className="u-mt-12"
        title={t("dmInventory.transfersTitle")}
        subtitle={t("dmInventory.transfersHint")}
        actions={(
          <button className="btn secondary" onClick={loadTransfers}><RefreshCcw className="icon" aria-hidden="true" />{t("dmInventory.refresh")}</button>
        )}
      >
        <FilterBar>
          <input
            value={transferQ}
            onChange={(e) => setTransferQ(e.target.value)}
            placeholder={t("dmInventory.transferSearch")}
            className="u-w-full"
          />
        </FilterBar>
        <div className="u-mt-8">
          {transfersLoading ? (
            <Skeleton h={80} w="100%" />
          ) : filteredTransfers.length === 0 ? (
            <div className="small">
              {transfers.length ? t("dmInventory.transferNotFound") : t("dmInventory.transferEmpty")}
            </div>
          ) : (
            <div className="list">
              {filteredTransfers.map((tr) => (
                <div key={tr.id} className="item u-items-start">
                  <div className="u-flex-1">
                    <div className="row u-row-gap-8 u-row-wrap">
                      {Number(tr.expiresAt || 0) > 0 && Number(tr.expiresAt) <= Date.now() ? (
                        <span className="badge secondary">{t("dmInventory.transferExpiredBadge")}</span>
                      ) : null}
                      <span className="badge secondary">{t("dmInventory.transferFrom", { value: tr.fromName || `#${tr.fromPlayerId}` })}</span>
                      <span className="badge secondary">{t("dmInventory.transferTo", { value: tr.toName || `#${tr.toPlayerId}` })}</span>
                      <span className="badge">{t("dmInventory.transferQty", { value: tr.qty })}</span>
                      <span className="small">{new Date(tr.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="small u-mt-6">
                      {t("dmInventory.transferItem", { value: tr.itemName || `#${tr.itemId}` })}
                    </div>
                    {tr.note ? (
                      <div className="small u-mt-6">
                        <b>{t("dmInventory.transferNoteLabel")}</b> {tr.note}
                      </div>
                    ) : null}
                  </div>
                  <div className="row u-row-gap-8 u-row-wrap">
                    <button className="btn danger" onClick={() => cancelTransfer(tr)} disabled={readOnly}>
                      {t("dmInventory.transferCancel")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      <div
        className={`list inv-shelf u-mt-12 ${view === "grid" ? "inv-grid" : ""}`}
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
            {rowVirtualizer.getVirtualItems().map((vRow) => {
              const it = filtered[vRow.index];
              return (
                <div
                  key={it.id}
                  data-index={vRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vRow.start}px)`
                  }}
                >
                  <InventoryItemCard
                    item={it}
                    readOnly={readOnly}
                    actionsVariant="stack"
                    onEdit={() => startEdit(it)}
                    onDelete={() => delItem(it)}
                    onToggleVisibility={() => toggleVisibility(it)}
                    selectable
                    selected={selectedIds.has(it.id)}
                    onSelectChange={(checked) => toggleSelect(it.id, checked)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          filtered.map((it) => (
            <InventoryItemCard
              key={it.id}
              item={it}
              readOnly={readOnly}
              actionsVariant="compact"
              onEdit={() => startEdit(it)}
              onDelete={() => delItem(it)}
              onToggleVisibility={() => toggleVisibility(it)}
              selectable
              selected={selectedIds.has(it.id)}
              onSelectChange={(checked) => toggleSelect(it.id, checked)}
            />
          ))
        )}
      </div>

      <Modal open={open} title={edit ? t("dmInventory.editItem") : t("dmInventory.issueItem")} onClose={() => setOpen(false)}>
        <div className="list">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("dmInventory.formName")} className="u-w-full" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("dmInventory.formDescription")} rows={4} className="u-w-full" />
          <div className="row">
            <input value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} placeholder={t("dmInventory.formQty")} className="u-w-full" />
            <input value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder={t("dmInventory.formWeight")} className="u-w-full" />
          </div>
          <div className="row">
            <select value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value })} className="u-w-full">
              {RARITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })} className="u-w-full">
              <option value="public">{t("dmInventory.visibilityPublic")}</option>
              <option value="hidden">{t("dmInventory.visibilityHidden")}</option>
            </select>
          </div>

          <div className="row u-items-center">
            <select
              value={form.iconKey || ""}
              onChange={(e) => setForm({ ...form, iconKey: e.target.value })}
              className="u-w-full"
            >
              <option value="">{t("dmInventory.iconNone")}</option>
              {INVENTORY_ICON_SECTIONS.map((section) => (
                <optgroup key={section.key} label={section.label}>
                  {section.items.map((icon) => (
                    <option key={icon.key} value={icon.key}>{icon.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="badge secondary u-inline-center u-row-gap-8">
              {SelectedIcon ? (
                <SelectedIcon className="inv-icon u-icon-28" aria-hidden="true" />
              ) : (
                <span className="small">{t("dmInventory.iconNoIcon")}</span>
              )}
            </div>
          </div>
          <details className="inv-icon-picker" open>
            <summary>{t("dmInventory.iconList")}</summary>
            <div className="inv-icon-grid">
              {INVENTORY_ICON_SECTIONS.map((section) => (
                <div key={section.key} className="inv-icon-section">
                  <div className="inv-icon-section-title">{section.label}</div>
                  <div className="inv-icon-section-grid">
                    {section.items.map((icon) => {
                      const Icon = icon.Icon;
                      const active = form.iconKey === icon.key;
                      return (
                        <button
                          key={icon.key}
                          type="button"
                          className={`inv-icon-tile${active ? " active" : ""}`}
                          onClick={() => setForm({ ...form, iconKey: icon.key })}
                          title={icon.label}
                          aria-pressed={active}
                        >
                          <Icon className="inv-icon" aria-hidden="true" />
                          <span>{icon.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </details>
          <input
            value={(form.tags || []).join(", ")}
            onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            placeholder={t("dmInventory.formTags")}
            className="u-w-full"
          />
          <button className="btn" onClick={save} disabled={readOnly}>{edit ? t("common.save") : t("dmInventory.issue")}</button>
        </div>
      </Modal>

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

function filterInventory(items, { q, vis, rarity }) {
  const list = items || [];
  const qq = String(q || "").toLowerCase().trim();
  return list.filter((it) => {
    if (vis && String(it.visibility) !== vis) return false;
    if (rarity && String(it.rarity || "") !== rarity) return false;
    if (!qq) return true;
    return String(it.name || "").toLowerCase().includes(qq);
  });
}

function summarizeInventory(list) {
  return (list || []).reduce((acc, it) => {
    const qty = Number(it.qty) || 1;
    const weight = Number(it.weight) || 0;
    acc.totalWeight += weight * qty;
    if (String(it.visibility) === "hidden") acc.hiddenCount += 1;
    else acc.publicCount += 1;
    return acc;
  }, { totalWeight: 0, publicCount: 0, hiddenCount: 0 });
}

function filterTransfers(list, q) {
  const items = Array.isArray(list) ? list : [];
  const qq = String(q || "").toLowerCase().trim();
  if (!qq) return items;
  return items.filter((tr) => {
    const hay = [
      tr.itemName,
      tr.toName,
      tr.fromName,
      tr.note,
      String(tr.toPlayerId || ""),
      String(tr.fromPlayerId || "")
    ].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(qq);
  });
}
