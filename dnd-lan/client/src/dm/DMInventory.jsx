import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";
import InventoryItemCard from "../components/vintage/InventoryItemCard.jsx";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Eye, EyeOff, LayoutGrid, List, Package, Plus, RefreshCcw, Scale } from "lucide-react";
import ErrorBanner from "../components/ui/ErrorBanner.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import { formatError } from "../lib/formatError.js";
import { RARITY_OPTIONS } from "../lib/inventoryRarity.js";
import { useDebouncedValue } from "../lib/useDebouncedValue.js";
import { useVirtualizer } from "@tanstack/react-virtual";

const empty = { name:"", description:"", qty:1, weight:0, rarity:"common", tags:[], visibility:"public", imageUrl:"" };

export default function DMInventory() {
  const [players, setPlayers] = useState([]);
  const [selectedId, setSelectedId] = useState(0);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
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

  function startAdd() {
    setEdit(null);
    setForm(empty);
    setOpen(true);
  }

  function startEdit(item) {
    setEdit(item);
    setForm({ ...item, imageUrl: item.imageUrl || item.image_url || "", tags: item.tags || [] });
    setOpen(true);
  }

  async function save() {
    setErr("");
    try {
      const payload = { ...form, qty: Number(form.qty), weight: Number(form.weight), tags: (form.tags || []).filter(Boolean) };
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

  async function onPickImage(ev) {
    const f = ev.target.files?.[0];
    if (!f) return;
    setErr("");
    setUploading(true);
    try {
      const r = await api.uploadAsset(f);
      setForm((prev) => ({ ...prev, imageUrl: r.url || "" }));
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setUploading(false);
      ev.target.value = "";
    }
  }

  const filtered = useMemo(() => filterInventory(items, { q: debouncedQ, vis, rarity }), [items, debouncedQ, vis, rarity]);
  const { totalWeight, publicCount, hiddenCount } = useMemo(() => summarizeInventory(filtered), [filtered]);
  const hasAny = items.length > 0;
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
        <button className="btn" onClick={startAdd} disabled={!selectedId}><Plus className="icon" />Выдать</button>
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
          <List className="icon" />Список
        </button>
        <button className={`btn ${view === "grid" ? "" : "secondary"}`} onClick={() => setView("grid")}>
          <LayoutGrid className="icon" />Плитка
        </button>
        <button className="btn secondary" onClick={() => loadInv(selectedId)} disabled={!selectedId}>
          <RefreshCcw className="icon" />Обновить
        </button>
      </div>
      <div className="small" style={{ marginTop: 10 }}>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <span className="badge"><Package className="icon" />Всего: {filtered.length}</span>
          <span className="badge ok"><Eye className="icon" />Публичные: {publicCount}</span>
          <span className="badge off"><EyeOff className="icon" />Скрытые: {hiddenCount}</span>
          <span className="badge secondary"><Scale className="icon" />Вес: {totalWeight.toFixed(2)}</span>
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
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPickImage} />
            <button className="btn secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? "Загрузка..." : "Загрузить изображение"}
            </button>
            <input
              value={form.imageUrl || ""}
              onChange={(e)=>setForm({ ...form, imageUrl: e.target.value })}
              placeholder="URL изображения"
              style={inp}
            />
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
