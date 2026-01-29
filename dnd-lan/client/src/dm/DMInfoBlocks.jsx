import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";
import { connectSocket } from "../socket.js";

const empty = { title:"", content:"", category:"note", access:"dm", selectedPlayerIds:[], tags:[] };

export default function DMInfoBlocks() {
  const [items, setItems] = useState([]);
  const [players, setPlayers] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const taRef = useRef(null);
  const socket = useMemo(() => connectSocket({ role: "dm" }), []);

  async function load() {
    const r = await api.infoBlocks();
    setItems(r.items || []);
    const p = await api.dmPlayers();
    setPlayers(p.items || []);
  }

  useEffect(() => {
    load().catch(()=>{});
    socket.on("infoBlocks:updated", () => load().catch(()=>{}));
    return () => socket.disconnect();
  }, []);

  const filtered = items.filter((b) => (b.title || "").toLowerCase().includes(q.toLowerCase()));

  function startNew() {
    setErr("");
    setEdit(null);
    setForm(empty);
    setOpen(true);
  }
  function startEdit(b) {
    setErr("");
    setEdit(b);
    setForm({ ...b });
    setOpen(true);
  }

  async function save() {
    setErr("");
    const payload = {
      ...form,
      tags: (form.tagsText || "").split(",").map(s=>s.trim()).filter(Boolean),
      selectedPlayerIds: (form.selectedPlayerIds || []).map(Number)
    };
    delete payload.tagsText;
    try {
      if (edit) await api.dmInfoUpdate(edit.id, payload);
      else await api.dmInfoCreate(payload);
      setOpen(false);
      await load();
    } catch (e) {
      setErr(e.body?.error || e.message);
    }
  }
  async function del(id) {
    setErr("");
    try {
      await api.dmInfoDelete(id);
      await load();
    } catch (e) {
      setErr(e.body?.error || e.message);
    }
  }

  function insertAtCursor(snippet) {
    const el = taRef.current;
    if (!el) {
      setForm((p) => ({ ...p, content: (p.content || "") + "\n" + snippet + "\n" }));
      return;
    }
    const start = el.selectionStart ?? (form.content || "").length;
    const end = el.selectionEnd ?? start;
    const next = (form.content || "").slice(0, start) + snippet + (form.content || "").slice(end);
    setForm((p) => ({ ...p, content: next }));
    setTimeout(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  }

  async function onPickFile(ev) {
    const f = ev.target.files?.[0];
    if (!f) return;
    setErr("");
    try {
      const r = await api.dmInfoUploadAsset(f);
      insertAtCursor(`\n${r.markdown}\n`);
    } catch (e) {
      setErr(e.body?.error || e.message);
    } finally {
      ev.target.value = "";
    }
  }

  return (
    <div className="spread-grid">
      <div className="spread-col">
        <div className="card taped scrap-card paper-stack">
          <div className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 20 }}>Info Blocks (DM)</div>
              <div className="small">Доступ: DM-only / All / Selected players</div>
            </div>
            <button className="btn" onClick={startNew}>+ Добавить</button>
          </div>
          <hr />
          {err && <div className="badge off">Ошибка: {err}</div>}
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Поиск…" style={inp} />
          <div className="list" style={{ marginTop: 12 }}>
            {filtered.map((b) => (
              <div key={b.id} className="item taped note-card" data-cat={b.category || "note"}>
                <div>
                  <div className="note-title">{b.title}</div>
                  <div className="note-meta">
                    <span className="badge secondary">{b.category}</span>
                    <span className="badge">{b.access}</span>
                  </div>
                </div>
                <div className="row">
                  <button className="btn secondary" onClick={() => startEdit(b)}>Ред.</button>
                  <button className="btn danger" onClick={() => del(b.id)}>Удал.</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="spread-col">
        <div className="card taped scrap-card">
          <div style={{ fontWeight: 800 }}>Легенда доступа</div>
          <div className="small">Кому видны блоки</div>
          <hr />
          <div className="list">
            <div className="item">
              <div className="kv">
                <div style={{ fontWeight: 700 }}>DM-only</div>
                <div className="small">Только мастер</div>
              </div>
            </div>
            <div className="item">
              <div className="kv">
                <div style={{ fontWeight: 700 }}>All</div>
                <div className="small">Все игроки</div>
              </div>
            </div>
            <div className="item">
              <div className="kv">
                <div style={{ fontWeight: 700 }}>Selected</div>
                <div className="small">Выбранные игроки</div>
              </div>
            </div>
          </div>
          <div className="paper-note" style={{ marginTop: 10 }}>
            <div className="title">Подсказка</div>
            <div className="small">Поддерживается markdown для текста и картинок.</div>
          </div>
        </div>
      </div>

      <Modal open={open} title={edit ? "Редактировать блок" : "Новый блок"} onClose={() => setOpen(false)}>
        <div className="list">
          {err && <div className="badge off">Ошибка: {err}</div>}
          <input value={form.title||""} onChange={(e)=>setForm({ ...form, title: e.target.value })} placeholder="Заголовок*" style={inp} />
          <div className="row">
            <select value={form.category||"note"} onChange={(e)=>setForm({ ...form, category: e.target.value })} style={inp}>
              <option value="lore">lore</option>
              <option value="quest">quest</option>
              <option value="note">note</option>
              <option value="other">other</option>
            </select>
            <select value={form.access||"dm"} onChange={(e)=>setForm({ ...form, access: e.target.value })} style={inp}>
              <option value="dm">DM-only</option>
              <option value="all">All players</option>
              <option value="selected">Selected players</option>
            </select>
          </div>

          {form.access === "selected" && (
            <div className="card taped">
              <div style={{ fontWeight: 700 }}>Кто видит</div>
              <div className="list" style={{ marginTop: 8 }}>
                {players.map((p) => {
                  const checked = (form.selectedPlayerIds || []).includes(p.id);
                  return (
                    <label key={p.id} className="small" style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const set = new Set(form.selectedPlayerIds || []);
                          e.target.checked ? set.add(p.id) : set.delete(p.id);
                          setForm({ ...form, selectedPlayerIds: Array.from(set) });
                        }}
                      />
                      {p.displayName} (id:{p.id})
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <input ref={fileRef} type="file" style={{ display: "none" }} onChange={onPickFile} />
            <button className="btn secondary" onClick={() => fileRef.current?.click()}>Загрузить файл</button>
            <div className="small">Вставит markdown для картинки/файла</div>
          </div>

          <textarea
            ref={taRef}
            value={form.content||""}
            onChange={(e)=>setForm({ ...form, content: e.target.value })}
            placeholder="Содержание (markdown/текст)"
            rows={8}
            style={inp}
          />
          <input
            value={form.tagsText ?? (form.tags || []).join(", ")}
            onChange={(e)=>setForm({ ...form, tagsText: e.target.value })}
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
