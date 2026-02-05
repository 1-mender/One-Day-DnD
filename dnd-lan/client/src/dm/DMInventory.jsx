import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";
import InventoryItemCard from "../components/vintage/InventoryItemCard.jsx";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Eye, EyeOff, LayoutGrid, List, Package, Plus, RefreshCcw, Scale, Trash2 } from "lucide-react";
import ErrorBanner from "../components/ui/ErrorBanner.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
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

const empty = { name:"", description:"", qty:1, weight:0, rarity:"common", tags:[], visibility:"public", iconKey:"" };

export default function DMInventory() {
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

  const loadPlayers = useCallback(async () => {
    setErr("");
    try {
      const p = await api.dmPlayers();
      const list = p.items || [];
      setPlayers(list);
      if (!list.length) {
        setSelectedId(0);
        setItems([]);
        setLoading(false);
      } else {
        setSelectedId((prev) => (prev ? prev : list[0].id));
      }
    } catch (e) {
      setErr(formatError(e));
      setLoading(false);
    }
  }, []);

  async function loadInv(pid) {
    if (!pid) return;
    setErr("");
    setLoading(true);
    try {
      const r = await api.invDmGetPlayer(pid);
      setItems(r.items || []);
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlayers().catch(() => {});
  }, [loadPlayers]);

  useEffect(() => {
    if (selectedId) loadInv(selectedId).catch(()=>{});
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
    setEdit(null);
    setForm(empty);
    setOpen(true);
  }

  function startEdit(item) {
    setEdit(item);
    const rest = { ...(item || {}) };
    delete rest.imageUrl;
    delete rest.image_url;
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
    } catch (e) {
      setErr(formatError(e));
    }
  }

  async function delItem(item) {
    if (!item) return;
    if (!window.confirm(`Удалить предмет "${item.name}"?`)) return;
    setErr("");
    try {
      await api.invDmDeletePlayerItem(selectedId, item.id);
      await loadInv(selectedId);
    } catch (e) {
      setErr(formatError(e));
    }
  }

  async function toggleVisibility(item) {
    if (!item) return;
    const next = item.visibility === "hidden" ? "public" : "hidden";
    try {
      await api.invDmUpdatePlayerItem(selectedId, item.id, { ...item, visibility: next, tags: item.tags || [] });
      await loadInv(selectedId);
    } catch (e) {
      setErr(formatError(e));
    }
  }

  async function bulkHideSelected() {
    if (!selectedId || selectedIds.size === 0) return;
    const targets = selectedItems.filter((it) => it.visibility !== "hidden");
    if (!targets.length) return;
    setErr("");
    try {
      for (const it of targets) {
        await api.invDmUpdatePlayerItem(selectedId, it.id, { ...it, visibility: "hidden", tags: it.tags || [] });
      }
      await loadInv(selectedId);
      clearSelection();
    } catch (e) {
      setErr(formatError(e));
    }
  }

  async function bulkDeleteSelected() {
    if (!selectedId || selectedIds.size === 0) return;
    const targets = selectedItems;
    if (!targets.length) return;
    if (!window.confirm(`\u0423\u0434\u0430\u043b\u0438\u0442\u044c ${targets.length} \u043f\u0440\u0435\u0434\u043c\u0435\u0442(\u043e\u0432)?`)) return;
    setErr("");
    try {
      for (const it of targets) {
        await api.invDmDeletePlayerItem(selectedId, it.id);
      }
      await loadInv(selectedId);
      clearSelection();
    } catch (e) {
      setErr(formatError(e));
    }
  }


  const filtered = useMemo(() => filterInventory(items, { q: debouncedQ, vis, rarity }), [items, debouncedQ, vis, rarity]);
  const { totalWeight, publicCount, hiddenCount } = useMemo(() => summarizeInventory(filtered), [filtered]);
  const { totalWeight: totalWeightAll } = useMemo(() => summarizeInventory(items), [items]);
  const hasAny = items.length > 0;
  const selectedCount = selectedIds.size;
  const selectedItems = useMemo(() => items.filter((it) => selectedIds.has(it.id)), [items, selectedIds]);
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
      <div>
        <div style={{ fontWeight: 900, fontSize: 20 }}>Inventory (DM)</div>
        <div className="small">Просмотр/выдача предметов игрокам</div>
      </div>
      <hr />
      <ErrorBanner message={err} onRetry={() => loadInv(selectedId)} />
      <div className="inv-toolbar">
        <select value={selectedId} onChange={(e)=>setSelectedId(Number(e.target.value))} style={inp}>
          {players.map((p) => <option key={p.id} value={p.id}>{p.displayName} (id:{p.id})</option>)}
        </select>
        <button className="btn" onClick={startAdd} disabled={!selectedId}><Plus className="icon" aria-hidden="true" />Выдать</button>
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Поиск по названию..." style={{ width: "min(360px, 100%)" }} />
        <select value={vis} onChange={(e)=>setVis(e.target.value)} style={{ width: 180 }}>
          <option value="">Видимость: все</option>
          <option value="public">Публичные</option>
          <option value="hidden">Скрытые</option>
        </select>
        <select value={rarity} onChange={(e)=>setRarity(e.target.value)} style={{ width: 180 }}>
          <option value="">Редкость: все</option>
          {RARITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button className={`btn ${view === "list" ? "" : "secondary"}`} onClick={() => setView("list")}>
          <List className="icon" aria-hidden="true" />Список
        </button>
        <button className={`btn ${view === "grid" ? "" : "secondary"}`} onClick={() => setView("grid")}>
          <LayoutGrid className="icon" aria-hidden="true" />Плитка
        </button>
        <button className="btn secondary" onClick={() => loadInv(selectedId)} disabled={!selectedId}>
          <RefreshCcw className="icon" aria-hidden="true" />Обновить
        </button>
        <span className="badge secondary">{"\u0412\u044b\u0431\u0440\u0430\u043d\u043e: "}{selectedCount}</span>
        <button
          className="btn secondary"
          onClick={bulkHideSelected}
          disabled={!selectedId || selectedCount === 0}
          title={"Скрыть выбранные"}
        >
          <EyeOff className="icon" aria-hidden="true" />
          {"Скрыть"}
        </button>
        <button
          className="btn danger"
          onClick={bulkDeleteSelected}
          disabled={!selectedId || selectedCount === 0}
          title={"Удалить выбранные"}
        >
          <Trash2 className="icon" aria-hidden="true" />
          {"Удалить"}
        </button>
        {selectedCount > 0 ? (
          <button className="btn secondary" onClick={clearSelection}>
            {"Снять выбор"}
          </button>
        ) : null}

      </div>
      <div className="small" style={{ marginTop: 10 }}>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <span className="badge"><Package className="icon" aria-hidden="true" />Всего: {filtered.length}</span>
          <span className="badge ok"><Eye className="icon" aria-hidden="true" />Публичные: {publicCount}</span>
          <span className="badge off"><EyeOff className="icon" aria-hidden="true" />Скрытые: {hiddenCount}</span>
          <span className="badge secondary"><Scale className="icon" aria-hidden="true" />Вес: {totalWeightAll.toFixed(2)}</span>
        </div>
      </div>

      <div
        className={`list inv-shelf ${view === "grid" ? "inv-grid" : ""}`}
        style={{ marginTop: 12, height: view === "list" ? "70vh" : undefined, overflow: view === "list" ? "auto" : undefined }}
        ref={view === "grid" ? autoAnimateRef : listRef}
      >
        {loading ? (
          <>
            <div className="item"><Skeleton h={86} w="100%" /></div>
            <div className="item"><Skeleton h={86} w="100%" /></div>
          </>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={hasAny ? "Ничего не найдено" : "Нет предметов у игрока"}
            hint={hasAny ? "Попробуйте изменить фильтры или поиск." : "Выдайте предмет или выберите другого игрока."}
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
                    readOnly={false}
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
              readOnly={false}
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

      <Modal open={open} title={edit ? "Редактировать предмет" : "Выдать предмет"} onClose={() => setOpen(false)}>
        <div className="list">
          <input value={form.name} onChange={(e)=>setForm({ ...form, name: e.target.value })} placeholder="Название*" style={inp} />
          <textarea value={form.description} onChange={(e)=>setForm({ ...form, description: e.target.value })} placeholder="Описание" rows={4} style={inp} />
          <div className="row">
            <input value={form.qty} onChange={(e)=>setForm({ ...form, qty: e.target.value })} placeholder="Количество" style={inp} />
            <input value={form.weight} onChange={(e)=>setForm({ ...form, weight: e.target.value })} placeholder="Вес" style={inp} />
          </div>
          <div className="row">
            <select value={form.rarity} onChange={(e)=>setForm({ ...form, rarity: e.target.value })} style={inp}>
              {RARITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select value={form.visibility} onChange={(e)=>setForm({ ...form, visibility: e.target.value })} style={inp}>
              <option value="public">Public</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>

          <div className="row" style={{ alignItems: "center" }}>
            <select
              value={form.iconKey || ""}
              onChange={(e)=>setForm({ ...form, iconKey: e.target.value })}
              style={inp}
            >
              <option value="">{"\u0418\u043a\u043e\u043d\u043a\u0430: \u043d\u0435\u0442"}</option>
              {INVENTORY_ICON_SECTIONS.map((section) => (
                <optgroup key={section.key} label={section.label}>
                  {section.items.map((icon) => (
                    <option key={icon.key} value={icon.key}>{icon.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="badge secondary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {SelectedIcon ? (
                <SelectedIcon className="inv-icon" aria-hidden="true" style={{ width: 28, height: 28 }} />
              ) : (
                <span className="small">{"\u0411\u0435\u0437 \u0438\u043a\u043e\u043d\u043a\u0438"}</span>
              )}
            </div>
          </div>
          <input
            value={(form.tags || []).join(", ")}
            onChange={(e)=>setForm({ ...form, tags: e.target.value.split(",").map(s=>s.trim()).filter(Boolean) })}
            placeholder="Теги (через запятую)"
            style={inp}
          />
          <button className="btn" onClick={save}>{edit ? "Сохранить" : "Выдать"}</button>
        </div>
      </Modal>
    </div>
  );
}
const inp = { width: "100%" };

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
