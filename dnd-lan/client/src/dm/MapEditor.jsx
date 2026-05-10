import React, { useEffect, useState } from "react";
import { api } from "../api.js";

function LocationRow({ loc, onEdit, onDelete }) {
  return (
    <div className="map-editor-row">
      <div className="map-editor-row-main">
        <strong>{loc.name}</strong>
        <div className="muted">{loc.id} • {loc.category || "-"}</div>
      </div>
      <div className="map-editor-row-actions">
        <button className="btn" onClick={() => onEdit(loc)}>Edit</button>
        <button className="btn danger" onClick={() => onDelete(loc.id)}>Delete</button>
      </div>
    </div>
  );
}

export default function MapEditor() {
  const [locations, setLocations] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [editingToken, setEditingToken] = useState(null);
  const [form, setForm] = useState({ name: "", id: "", category: "", description: "", default_x: 50, default_y: 50 });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const locs = await api.dmListLocations();
      const toks = await api.dmListTokens();
      const ms = await api.dmListMaps();
      setLocations(Array.isArray(locs?.locations) ? locs.locations : []);
      setTokens(Array.isArray(toks?.tokens) ? toks.tokens : []);
      setMaps(Array.isArray(ms?.maps) ? ms.maps : []);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startCreate = () => { setEditing("new"); setForm({ name: "", id: "", category: "", description: "", default_x: 50, default_y: 50 }); };
  const startEdit = (loc) => { setEditing(loc.id); setForm({ name: loc.name, id: loc.id, category: loc.category || "", description: loc.description || "", default_x: loc.defaultX ?? loc.default_x ?? 50, default_y: loc.defaultY ?? loc.default_y ?? 50 }); };

  const save = async () => {
    try {
      setError("");
      if (editing === "new") {
        await api.dmCreateLocation(form);
      } else {
        await api.dmUpdateLocation(editing, form);
      }
      await load();
      setEditing(null);
    } catch (err) {
      setError(String(err?.message || err));
    }
  };

  const remove = async (id) => {
    if (!confirm("Удалить локацию?")) return;
    try { setError(""); await api.dmDeleteLocation(id); await load(); } catch (err) { setError(String(err?.message || err)); }
  };

  // Simple token create/delete (no edit form for brevity)
  const createToken = async () => {
    const name = prompt("Имя жетона (NPC)");
    if (!name) return;
    try { await api.dmCreateToken({ name }); await load(); } catch (err) { setError(String(err?.message || err)); }
  };
  const deleteToken = async (id) => { if (!confirm("Удалить жетон?")) return; try { await api.dmDeleteToken(id); await load(); } catch (err) { setError(String(err?.message || err)); } };
  const startEditToken = (token) => { setEditingToken(token.id); setForm({ name: token.name || "", type: token.type || "", id: token.id }); };
  const saveToken = async () => {
    try {
      setError("");
      if (editingToken) {
        await api.dmUpdateToken(editingToken, { name: form.name, type: form.type });
      }
      await load();
      setEditingToken(null);
      setForm({ name: "", id: "", category: "", description: "", default_x: 50, default_y: 50 });
    } catch (err) {
      setError(String(err?.message || err));
    }
  };

  return (
    <div className="dm-map-editor">
      <h1>Map Editor (DM)</h1>
      {error ? <div className="badge off">{error}</div> : null}
      <section className="card">
        <h2>Maps</h2>
        <div className="muted">Загрузите изображение карты (PNG/JPEG)</div>
        <input type="file" accept="image/*" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            setError("");
            const r = await api.dmUploadMap(f, f.name);
            await load();
            // optionally activate uploaded map immediately
            if (r?.map?.id) await api.dmActivateMap(r.map.id);
            await load();
          } catch (err) { setError(String(err?.message || err)); }
        }} />
        {maps.length === 0 ? <div className="muted">Нет загруженных карт</div> : maps.map((m) => (
          <div key={m.id} className="map-editor-row">
            <div className="map-editor-row-main"><strong>{m.name || m.filename}</strong><div className="muted">{m.width}×{m.height}</div></div>
            <div className="map-editor-row-actions"><button className="btn" onClick={async () => { try { setError(""); await api.dmActivateMap(m.id); await load(); } catch (err) { setError(String(err?.message||err)); } }}>Activate</button></div>
          </div>
        ))}
      </section>
      <div className="dm-map-editor-actions">
        <button className="btn" onClick={startCreate}>Создать локацию</button>
        <button className="btn" onClick={createToken}>Создать жетон</button>
        <button className="btn" onClick={load} disabled={loading}>{loading ? "Загрузка..." : "Обновить"}</button>
      </div>

      <section className="card">
        <h2>Локации</h2>
        {locations.length === 0 ? <div className="muted">Нет локаций</div> : locations.map((l) => (
          <LocationRow key={l.id} loc={l} onEdit={startEdit} onDelete={remove} />
        ))}
      </section>

      <section className="card">
        <h2>Жетоны</h2>
        {tokens.length === 0 ? <div className="muted">Нет жетонов</div> : tokens.map((t) => (
          <div key={t.id} className="map-editor-row">
            <div className="map-editor-row-main"><strong>{t.name || `#${t.id}`}</strong><div className="muted">{t.type || "-"}</div></div>
            <div className="map-editor-row-actions"><button className="btn" onClick={() => startEditToken(t)}>Edit</button> <button className="btn danger" onClick={() => deleteToken(t.id)}>Delete</button></div>
          </div>
        ))}
      </section>

      {editing ? (
        <aside className="card">
          <h3>{editing === "new" ? "Создать локацию" : `Редактировать ${editing}`}</h3>
          <label>Название<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Id<input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} disabled={editing !== "new"} /></label>
          <label>Категория<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
          <label>Описание<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label>X<input type="number" value={form.default_x} onChange={(e) => setForm({ ...form, default_x: Number(e.target.value) })} /></label>
          <label>Y<input type="number" value={form.default_y} onChange={(e) => setForm({ ...form, default_y: Number(e.target.value) })} /></label>
          <div className="dm-map-editor-form-actions">
            <button className="btn primary" onClick={save}>Сохранить</button>
            <button className="btn" onClick={() => setEditing(null)}>Отмена</button>
          </div>
        </aside>
      ) : null}
      {editingToken ? (
        <aside className="card">
          <h3>{`Редактировать жетон ${editingToken}`}</h3>
          <label>Имя<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Тип<input value={form.type || ""} onChange={(e) => setForm({ ...form, type: e.target.value })} /></label>
          <div className="dm-map-editor-form-actions">
            <button className="btn primary" onClick={saveToken}>Сохранить</button>
            <button className="btn" onClick={() => setEditingToken(null)}>Отмена</button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
