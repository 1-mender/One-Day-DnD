import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, storage } from "../api.js";
import Modal from "../components/Modal.jsx";
import { connectSocket } from "../socket.js";
import InventoryItemCard from "../components/vintage/InventoryItemCard.jsx";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { useQueryState } from "../hooks/useQueryState.js";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Eye, EyeOff, LayoutGrid, List, Package, Plus, RefreshCcw, Scale } from "lucide-react";
import ErrorBanner from "../components/ui/ErrorBanner.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import { formatError } from "../lib/formatError.js";
import { RARITY_OPTIONS } from "../lib/inventoryRarity.js";

const empty = { name:"", description:"", qty:1, weight:0, rarity:"common", tags:[], visibility:"public", imageUrl:"" };

export default function Inventory() {
  const toast = useToast();

  const [q, setQ] = useQueryState("q", "");
  const [vis, setVis] = useQueryState("vis", "");
  const [rarity, setRarity] = useQueryState("rarity", "");
  const [view, setView] = useQueryState("view", "list");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const socket = useMemo(() => connectSocket({ role: "player" }), []);
  const [listRef] = useAutoAnimate({ duration: 200 });

  const readOnly = storage.isImpersonating() && storage.getImpMode() === "ro";

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const r = await api.invMine();
      setItems(r.items || []);
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
    socket.on("inventory:updated", () => load().catch(() => {}));
    return () => socket.disconnect();
  }, [load, socket]);

  const filtered = useMemo(() => filterInventory(items, { q, vis, rarity }), [items, q, vis, rarity]);
  const { totalWeight, publicCount, hiddenCount } = useMemo(() => summarizeInventory(filtered), [filtered]);
  const hasAny = items.length > 0;

  function startAdd() {
    if (readOnly) return;
    setEdit(null);
    setForm(empty);
    setOpen(true);
  }
  function startEdit(it) {
    if (readOnly) return;
    setEdit(it);
    setForm({ ...it, imageUrl: it.imageUrl || it.image_url || "", tags: it.tags || [] });
    setOpen(true);
  }

  async function save() {
    if (readOnly) return;
    setErr("");
    try {
      if (!form.name.trim()) return;
      const payload = { ...form, qty: Number(form.qty), weight: Number(form.weight), tags: (form.tags||[]).filter(Boolean) };
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

  async function toggleVisibility(it) {
    if (readOnly) return;
    try {
      const next = it.visibility === "hidden" ? "public" : "hidden";
      await api.invUpdateMine(it.id, { ...it, visibility: next, tags: it.tags || [] });
      toast.success(`Видимость: ${next === "public" ? "Публичный" : "Скрытый"}`);
      await load();
    } catch (e) {
      toast.error(formatError(e));
    }
  }

  return (
    <div className="card taped">
      <div className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
        <div>
      <div style={{ fontWeight: 800, fontSize: 18 }}>Инвентарь</div>
      <div className="small">Вес (по фильтру): {totalWeight.toFixed(2)} {readOnly ? "• read-only" : ""}</div>
        </div>
        <button className="btn" onClick={startAdd} disabled={readOnly}><Plus className="icon" />Добавить</button>
      </div>
      <hr />
      <div className="row" style={{ flexWrap: "wrap" }}>
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Поиск по названию..." style={{ width: "min(520px, 100%)" }} />
        <select value={vis} onChange={(e)=>setVis(e.target.value)} style={{ width: 200 }}>
          <option value="">Видимость: все</option>
          <option value="public">Публичные</option>
          <option value="hidden">Скрытые</option>
        </select>
        <select value={rarity} onChange={(e)=>setRarity(e.target.value)} style={{ width: 200 }}>
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
        <button className="btn secondary" onClick={load}><RefreshCcw className="icon" />Обновить</button>
      </div>

      <div className="small" style={{ marginTop: 10 }}>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <span className="badge"><Package className="icon" />Всего: {filtered.length}</span>
          <span className="badge ok"><Eye className="icon" />Публичные: {publicCount}</span>
          <span className="badge off"><EyeOff className="icon" />Скрытые: {hiddenCount}</span>
          <span className="badge secondary"><Scale className="icon" />Вес: {totalWeight.toFixed(2)}</span>
          {readOnly ? <span className="badge warn">read-only</span> : null}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <ErrorBanner message={err} onRetry={load} />

        {loading ? (
          <div className="list">
            <div className="item"><Skeleton h={86} w="100%" /></div>
            <div className="item"><Skeleton h={86} w="100%" /></div>
            <div className="item"><Skeleton h={86} w="100%" /></div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={hasAny ? "Ничего не найдено" : "Инвентарь пуст"}
            hint={hasAny ? "Попробуйте изменить фильтры или поиск." : "Добавьте предмет, чтобы начать."}
          />
        ) : (
          <div className={`list inv-shelf ${view === "grid" ? "inv-grid" : ""}`} ref={listRef}>
            {filtered.map((it) => (
              <InventoryItemCard
                key={it.id}
                item={it}
                readOnly={readOnly}
                actionsVariant={view === "grid" ? "compact" : "stack"}
                onEdit={() => startEdit(it)}
                onDelete={() => del(it.id)}
                onToggleVisibility={() => toggleVisibility(it)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal open={open} title={edit ? "Редактировать предмет" : "Новый предмет"} onClose={() => setOpen(false)}>
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
          <input
            value={form.imageUrl || ""}
            onChange={(e)=>setForm({ ...form, imageUrl: e.target.value })}
            placeholder="URL изображения"
            style={inp}
          />
          <input
            value={(form.tags || []).join(", ")}
            onChange={(e)=>setForm({ ...form, tags: e.target.value.split(",").map(s=>s.trim()).filter(Boolean) })}
            placeholder="Теги (через запятую)"
            style={inp}
          />
          <button className="btn" onClick={save}>Сохранить</button>
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
