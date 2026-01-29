import React, { useEffect, useMemo, useState } from "react";
import { api, storage } from "../api.js";
import Modal from "../components/Modal.jsx";
import { connectSocket } from "../socket.js";
import InventoryItemCard from "../components/vintage/InventoryItemCard.jsx";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { useQueryState } from "../hooks/useQueryState.js";
import ErrorBanner from "../components/ui/ErrorBanner.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import { formatError } from "../lib/formatError.js";

const empty = { name:"", description:"", qty:1, weight:0, rarity:"common", tags:[], visibility:"public" };

export default function Inventory() {
  const toast = useToast();

  const [q, setQ] = useQueryState("q", "");
  const [vis, setVis] = useQueryState("vis", "");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const socket = useMemo(() => connectSocket({ role: "player" }), []);

  const readOnly = storage.isImpersonating() && storage.getImpMode() === "ro";

  async function load() {
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
  }

  useEffect(() => {
    load().catch(()=>{});
    socket.on("inventory:updated", () => load().catch(()=>{}));
    return () => socket.disconnect();
  }, []);

  const filtered = useMemo(() => {
    const qq = String(q || "").toLowerCase().trim();
    return (items || []).filter((it) => {
      if (vis && String(it.visibility) !== vis) return false;
      if (!qq) return true;
      return String(it.name || "").toLowerCase().includes(qq);
    });
  }, [items, q, vis]);
  const totalWeight = filtered.reduce((s, it) => s + (Number(it.weight)||0) * (Number(it.qty)||1), 0);

  function startAdd() {
    if (readOnly) return;
    setEdit(null);
    setForm(empty);
    setOpen(true);
  }
  function startEdit(it) {
    if (readOnly) return;
    setEdit(it);
    setForm({ ...it, tags: it.tags || [] });
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
        <button className="btn" onClick={startAdd} disabled={readOnly}>+ Добавить</button>
      </div>
      <hr />
      <div className="row" style={{ flexWrap: "wrap" }}>
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Поиск по названию..." style={{ width: "min(520px, 100%)" }} />
        <select value={vis} onChange={(e)=>setVis(e.target.value)} style={{ width: 200 }}>
          <option value="">Видимость: все</option>
          <option value="public">Публичные</option>
          <option value="hidden">Скрытые</option>
        </select>
        <button className="btn secondary" onClick={load}>Обновить</button>
      </div>

      <div className="small" style={{ marginTop: 10 }}>
        Всего: <b>{filtered.length}</b> • Вес: <b>{totalWeight.toFixed(2)}</b> {readOnly ? "• read-only" : ""}
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
          <EmptyState title="Нет предметов" hint="Добавьте предмет или измените фильтры." />
        ) : (
          <div className="list">
            {filtered.map((it) => (
              <InventoryItemCard
                key={it.id}
                item={it}
                readOnly={readOnly}
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
              <option value="common">common</option>
              <option value="uncommon">uncommon</option>
              <option value="rare">rare</option>
              <option value="very_rare">very_rare</option>
              <option value="legendary">legendary</option>
              <option value="custom">custom</option>
            </select>
            <select value={form.visibility} onChange={(e)=>setForm({ ...form, visibility: e.target.value })} style={inp}>
              <option value="public">Public</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
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
