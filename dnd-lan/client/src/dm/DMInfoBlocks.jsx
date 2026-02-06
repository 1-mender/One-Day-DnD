import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";
import { useDebouncedValue } from "../lib/useDebouncedValue.js";
import { formatError } from "../lib/formatError.js";
import ActionMenu from "../components/ui/ActionMenu.jsx";
import MarkdownView from "../components/markdown/MarkdownView.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { useReadOnly } from "../hooks/useReadOnly.js";
import { useQueryState } from "../hooks/useQueryState.js";

const empty = { title:"", content:"", category:"note", access:"dm", selectedPlayerIds:[], tags:[] };

export default function DMInfoBlocks() {
  const [items, setItems] = useState([]);
  const [players, setPlayers] = useState([]);
  const [q, setQ] = useQueryState("q", "");
  const [cat, setCat] = useQueryState("cat", "");
  const [acc, setAcc] = useQueryState("access", "");
  const [selectedIdParam, setSelectedIdParam] = useQueryState("id", "");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const taRef = useRef(null);
  const { socket } = useSocket();
  const readOnly = useReadOnly();
  const debouncedQ = useDebouncedValue(q, 200);

  const load = useCallback(async () => {
    try {
      const r = await api.infoBlocks();
      setItems(r.items || []);
      const p = await api.dmPlayers();
      setPlayers(p.items || []);
    } catch (e) {
      setErr(formatError(e));
    }
  }, []);

  useEffect(() => {
    if (!socket) return () => {};
    load().catch(() => {});
    const onUpdated = () => load().catch(() => {});
    socket.on("infoBlocks:updated", onUpdated);
    return () => {
      socket.off("infoBlocks:updated", onUpdated);
    };
  }, [load, socket]);

  const selectedId = Number(selectedIdParam || 0);
  const selected = useMemo(() => items.find((b) => b.id === selectedId) || null, [items, selectedId]);

  const filtered = useMemo(() => {
    const dq = String(debouncedQ || "").toLowerCase();
    return items.filter((b) => {
      if (cat && String(b.category || "") !== cat) return false;
      if (acc && String(b.access || "") !== acc) return false;
      if (!dq) return true;
      const hay = [b.title, b.content, ...(b.tags || [])].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(dq);
    });
  }, [items, debouncedQ, cat, acc]);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p.displayName])), [players]);

  function startNew() {
    if (readOnly) return;
    setErr("");
    setEdit(null);
    setForm(empty);
    setOpen(true);
  }
  function startEdit(b) {
    if (readOnly) return;
    setErr("");
    setEdit(b);
    setForm({ ...b });
    setOpen(true);
  }

  function selectBlock(id) {
    if (!id) setSelectedIdParam("");
    else setSelectedIdParam(String(id));
  }

  async function setAccess(block, access) {
    if (readOnly) return;
    if (!block) return;
    setErr("");
    try {
      const payload = {
        ...block,
        access,
        tags: Array.isArray(block.tags) ? block.tags : [],
        selectedPlayerIds: Array.isArray(block.selectedPlayerIds) ? block.selectedPlayerIds.map(Number) : []
      };
      await api.dmInfoUpdate(block.id, payload);
      await load();
    } catch (e) {
      setErr(formatError(e));
    }
  }

  async function save() {
    if (readOnly) return;
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
      setErr(formatError(e));
    }
  }
  async function del(id) {
    if (readOnly) return;
    setErr("");
    try {
      await api.dmInfoDelete(id);
      await load();
    } catch (e) {
      setErr(formatError(e));
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
    if (readOnly) return;
    const f = ev.target.files?.[0];
    if (!f) return;
    setErr("");
    try {
      const r = await api.dmInfoUploadAsset(f);
      insertAtCursor(`\n${r.markdown}\n`);
    } catch (e) {
      setErr(formatError(e));
    } finally {
      ev.target.value = "";
    }
  }

  return (
    <>
      <div className="two-pane" data-detail={selected ? "1" : "0"}>
        <div className="pane pane-list">
          <div className="card taped scrap-card paper-stack">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 20 }}>Info Blocks (DM)</div>
                <div className="small">Access: DM-only / All / Selected players</div>
              </div>
              <button className="btn" onClick={startNew} disabled={readOnly}>+ Add</button>
            </div>
            <hr />
            {readOnly ? <div className="badge warn">Read-only: write disabled</div> : null}
            {err && <div className="badge off">Error: {err}</div>}
            <div className="row" style={{ flexWrap: "wrap" }}>
              <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search..." style={{ width: "min(420px, 100%)" }} />
              <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 160 }}>
                <option value="">Category: all</option>
                <option value="lore">lore</option>
                <option value="quest">quest</option>
                <option value="note">note</option>
                <option value="other">other</option>
              </select>
              <select value={acc} onChange={(e) => setAcc(e.target.value)} style={{ width: 180 }}>
                <option value="">Access: all</option>
                <option value="dm">DM-only</option>
                <option value="all">All players</option>
                <option value="selected">Selected players</option>
              </select>
            </div>
            <div className="list" style={{ marginTop: 12 }}>
              {filtered.map((b) => (
                <div
                  key={b.id}
                  className={`item taped note-card${selected?.id === b.id ? " selected" : ""}`}
                  data-cat={b.category || "note"}
                  onClick={() => selectBlock(b.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectBlock(b.id);
                    }
                  }}
                >
                  <div>
                    <div className="note-title">{b.title}</div>
                    <div className="note-meta">
                      <span className="badge secondary">{b.category}</span>
                      <span className="badge">{b.access}</span>
                    </div>
                  </div>
                  <ActionMenu
                    items={[
                      { label: "Edit", onClick: () => startEdit(b), disabled: readOnly },
                      { label: "Delete", onClick: () => del(b.id), disabled: readOnly, tone: "danger" },
                      { label: "Show to all", onClick: () => setAccess(b, "all"), disabled: readOnly },
                      { label: "DM only", onClick: () => setAccess(b, "dm"), disabled: readOnly },
                      { label: "Selected players", onClick: () => setAccess(b, "selected"), disabled: readOnly }
                    ]}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pane pane-detail">
          <div className="card taped scrap-card">
            {selected ? (
              <>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 20 }}>{selected.title}</div>
                    <div className="small">{selected.category} - {selected.access}</div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn secondary" onClick={() => selectBlock(0)}>Back to list</button>
                    <button className="btn" onClick={() => startEdit(selected)} disabled={readOnly}>Edit</button>
                  </div>
                </div>
                <hr />
                <div className="row" style={{ flexWrap: "wrap" }}>
                  {(selected.tags || []).slice(0, 4).map((t) => (
                    <span key={t} className="badge secondary">{t}</span>
                  ))}
                </div>
                {selected.access === "selected" ? (
                  <div className="small" style={{ marginTop: 8 }}>
                    Visible to: {(selected.selectedPlayerIds || []).map((id) => playerMap.get(id) || `#${id}`).join(", ") || "-"}
                  </div>
                ) : null}
                <div style={{ marginTop: 12 }}>
                  <MarkdownView source={selected.content || ""} />
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  <button className="btn secondary" onClick={() => setAccess(selected, "all")} disabled={readOnly}>Show to all</button>
                  <button className="btn secondary" onClick={() => setAccess(selected, "dm")} disabled={readOnly}>DM only</button>
                  <button className="btn secondary" onClick={() => setAccess(selected, "selected")} disabled={readOnly}>Selected players</button>
                  <button className="btn danger" onClick={() => del(selected.id)} disabled={readOnly}>Delete</button>
                </div>
              </>
            ) : (
              <>
                <div className="small">Select a block to see details.</div>
                <div className="paper-note" style={{ marginTop: 10 }}>
                  <div className="title">Hint</div>
                  <div className="small">Markdown supported for text and images.</div>
                </div>
              </>
            )}
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
            <button className="btn secondary" onClick={() => fileRef.current?.click()} disabled={readOnly}>Загрузить файл</button>
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
          <button className="btn" onClick={save} disabled={readOnly}>Сохранить</button>
        </div>
      </Modal>
    </>
  );
}
const inp = { width: "100%" };
