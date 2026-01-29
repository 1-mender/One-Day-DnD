import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";
import InventoryItemCard from "../components/vintage/InventoryItemCard.jsx";

const empty = { name:"", description:"", qty:1, weight:0, rarity:"common", tags:[], visibility:"public" };

export default function DMInventory() {
  const [players, setPlayers] = useState([]);
  const [selectedId, setSelectedId] = useState(0);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState("");

  async function loadPlayers() {
    setErr("");
    try {
      const p = await api.dmPlayers();
      setPlayers(p.items || []);
      if (!selectedId && (p.items || []).length) setSelectedId(p.items[0].id);
    } catch (e) {
      setErr(e.body?.error || e.message);
    }
  }

  async function loadInv(pid) {
    if (!pid) return;
    setErr("");
    try {
      const r = await api.invDmGetPlayer(pid);
      setItems(r.items || []);
    } catch (e) {
      setErr(e.body?.error || e.message);
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
      setErr(e.body?.error || e.message);
    }
  }

  return (
    <div className="card taped">
      <div style={{ fontWeight: 900, fontSize: 20 }}>Inventory (DM)</div>
      <div className="small">Просмотр/выдача предметов игрокам</div>
      <hr />
      {err && <div className="badge off">Ошибка: {err}</div>}
      <div className="row" style={{ alignItems:"center" }}>
        <select value={selectedId} onChange={(e)=>setSelectedId(Number(e.target.value))} style={inp}>
          {players.map((p) => <option key={p.id} value={p.id}>{p.displayName} (id:{p.id})</option>)}
        </select>
        <button className="btn" onClick={() => setOpen(true)} disabled={!selectedId}>+ Выдать</button>
      </div>
      <div className="list" style={{ marginTop: 12 }}>
        {items.length === 0 && <div className="badge warn">Нет предметов у игрока</div>}
        {items.map((it) => (
          <InventoryItemCard
            key={it.id}
            item={it}
            readOnly
          />
        ))}
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
