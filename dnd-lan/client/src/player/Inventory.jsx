import React, { useEffect, useMemo, useState } from "react";
import { api, storage } from "../api.js";
import Modal from "../components/Modal.jsx";
import { connectSocket } from "../socket.js";
import InventoryItemCard from "../components/vintage/InventoryItemCard.jsx";

const empty = { name:"", description:"", qty:1, weight:0, rarity:"common", tags:[], visibility:"public" };

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState("");
  const socket = useMemo(() => connectSocket({ role: "player" }), []);

  const readOnly = storage.isImpersonating() && storage.getImpMode() === "ro";

  async function load() {
    const r = await api.invMine();
    setItems(r.items || []);
  }

  useEffect(() => {
    load().catch(()=>{});
    socket.on("inventory:updated", () => load().catch(()=>{}));
    return () => socket.disconnect();
  }, []);

  const filtered = items.filter((it) => it.name.toLowerCase().includes(q.toLowerCase()));
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
    } catch (e) {
      setErr(e.body?.error || e.message);
    }
  }
  async function del(id) {
    if (readOnly) return;
    setErr("");
    try {
      await api.invDeleteMine(id);
      await load();
    } catch (e) {
      setErr(e.body?.error || e.message);
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Инвентарь</div>
          <div className="small">Вес (по фильтру): {totalWeight.toFixed(2)} {readOnly ? "• read-only" : ""}</div>
        </div>
        <button className="btn" onClick={startAdd} disabled={readOnly}>+ Добавить</button>
      </div>
      <hr />
      {err && <div className="badge off">Ошибка: {err}</div>}
      <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Поиск по названию…" style={{ width:"100%" }} />
      <div className="list" style={{ marginTop: 12 }}>
        {filtered.map((it) => (
          <InventoryItemCard
            key={it.id}
            item={it}
            readOnly={readOnly}
            onEdit={() => startEdit(it)}
            onDelete={() => del(it.id)}
          />
        ))}
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

const inp = { padding: 10, borderRadius: 12, border: "1px solid #1f2a3a", background:"#0b0f14", color:"#e7eef7", width:"100%" };
