import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";
import InventoryItemCard from "../components/vintage/InventoryItemCard.jsx";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Eye, EyeOff, LayoutGrid, List, Package, Plus, RefreshCcw, Scale } from "lucide-react";
import ErrorBanner from "../components/ui/ErrorBanner.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import { formatError } from "../lib/formatError.js";

const empty = { name:"", description:"", qty:1, weight:0, rarity:"common", tags:[], visibility:"public" };

export default function DMInventory() {
  const [players, setPlayers] = useState([]);
  const [selectedId, setSelectedId] = useState(0);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [vis, setVis] = useState("");
  const [rarity, setRarity] = useState("");
  const [view, setView] = useState("list");
  const [listRef] = useAutoAnimate({ duration: 200 });

  async function loadPlayers() {
    setErr("");
    try {
      const p = await api.dmPlayers();
      const list = p.items || [];
      setPlayers(list);
      if (!list.length) {
        setSelectedId(0);
        setItems([]);
        setLoading(false);
      } else if (!selectedId) {
        setSelectedId(list[0].id);
      }
    } catch (e) {
      setErr(formatError(e));
      setLoading(false);
    }
  }

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
    loadPlayers().catch(()=>{});
  }, []);

  useEffect(() => {
    if (selectedId) loadInv(selectedId).catch(()=>{});
  }, [selectedId]);

  async function give() {
    setErr("");
    try {
      await api.invDmAddToPlayer(selectedId, { ...form, qty: Number(form.qty), weight: Number(form.weight) });
      setOpen(false);
      setForm(empty);
      await loadInv(selectedId);
    } catch (e) {
      setErr(formatError(e));
    }
  }

  const filtered = useMemo(() => filterInventory(items, { q, vis, rarity }), [items, q, vis, rarity]);
  const { totalWeight, publicCount, hiddenCount } = useMemo(() => summarizeInventory(filtered), [filtered]);
  const hasAny = items.length > 0;

  return (
    <div className="card taped">
      <div className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 20 }}>Inventory (DM)</div>
          <div className="small">Просмотр/выдача предметов игрокам</div>
        </div>
        <button className="btn secondary" onClick={() => loadInv(selectedId)} disabled={!selectedId}>
          <RefreshCcw className="icon" />Обновить
        </button>
      </div>
      <hr />
      <ErrorBanner message={err} onRetry={() => loadInv(selectedId)} />
      <div className="row" style={{ alignItems:"center", flexWrap: "wrap" }}>
        <select value={selectedId} onChange={(e)=>setSelectedId(Number(e.target.value))} style={inp}>
          {players.map((p) => <option key={p.id} value={p.id}>{p.displayName} (id:{p.id})</option>)}
        </select>
        <button className="btn" onClick={() => setOpen(true)} disabled={!selectedId}><Plus className="icon" />Выдать</button>
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Поиск по названию..." style={{ width: "min(360px, 100%)" }} />
        <select value={vis} onChange={(e)=>setVis(e.target.value)} style={{ width: 180 }}>
          <option value="">Видимость: все</option>
          <option value="public">Публичные</option>
          <option value="hidden">Скрытые</option>
        </select>
        <select value={rarity} onChange={(e)=>setRarity(e.target.value)} style={{ width: 180 }}>
          <option value="">Редкость: все</option>
          <option value="common">common</option>
          <option value="uncommon">uncommon</option>
          <option value="rare">rare</option>
          <option value="very_rare">very_rare</option>
          <option value="legendary">legendary</option>
          <option value="custom">custom</option>
        </select>
        <button className={`btn ${view === "list" ? "" : "secondary"}`} onClick={() => setView("list")}>
          <List className="icon" />Список
        </button>
        <button className={`btn ${view === "grid" ? "" : "secondary"}`} onClick={() => setView("grid")}>
          <LayoutGrid className="icon" />Плитка
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

      <div className={`list inv-shelf ${view === "grid" ? "inv-grid" : ""}`} style={{ marginTop: 12 }} ref={listRef}>
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
        ) : (
          filtered.map((it) => (
            <InventoryItemCard
              key={it.id}
              item={it}
              readOnly
            />
          ))
        )}
      </div>

      <Modal open={open} title="Выдать предмет" onClose={() => setOpen(false)}>
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
          <button className="btn" onClick={give}>Выдать</button>
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
