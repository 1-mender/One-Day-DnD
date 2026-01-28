import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";

const empty = { name:"", description:"", qty:1, weight:0, rarity:"common", tags:[], visibility:"public" };

export default function DMInventory() {
  const [players, setPlayers] = useState([]);
  const [selectedId, setSelectedId] = useState(0);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  async function loadPlayers() {
    const p = await api.dmPlayers();
    setPlayers(p.items || []);
    if (!selectedId && (p.items || []).length) setSelectedId(p.items[0].id);
  }

  async function loadInv(pid) {
    if (!pid) return;
    const r = await api.invDmGetPlayer(pid);
    setItems(r.items || []);
  }

  useEffect(() => {
    loadPlayers().catch(()=>{});
  }, []);

  useEffect(() => {
    if (selectedId) loadInv(selectedId).catch(()=>{});
  }, [selectedId]);

  async function give() {
    await api.invDmAddToPlayer(selectedId, { ...form, qty: Number(form.qty), weight: Number(form.weight) });
    setOpen(false);
    setForm(empty);
    await loadInv(selectedId);
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 900, fontSize: 20 }}>Inventory (DM)</div>
      <div className="small">Просмотр/выдача предметов игрокам</div>
      <hr />
      <div className="row" style={{ alignItems:"center" }}>
        <select value={selectedId} onChange={(e)=>setSelectedId(Number(e.target.value))} style={inp}>
          {players.map((p) => <option key={p.id} value={p.id}>{p.displayName} (id:{p.id})</option>)}
        </select>
        <button className="btn" onClick={() => setOpen(true)} disabled={!selectedId}>+ Выдать</button>
      </div>
      <div className="list" style={{ marginTop: 12 }}>
        {items.map((it) => (
          <div key={it.id} className="item">
            <div className="kv">
              <div style={{ fontWeight: 800 }}>{it.name} <span className="small">x{it.qty}</span></div>
              <div className="small">{it.visibility}</div>
            </div>
            <span className="badge">{it.updated_by}</span>
          </div>
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
const inp = { padding: 10, borderRadius: 12, border: "1px solid #1f2a3a", background:"#0b0f14", color:"#e7eef7", width:"100%" };
