import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";
import { connectSocket } from "../socket.js";
import PolaroidFrame from "../components/vintage/PolaroidFrame.jsx";
import { formatError } from "../lib/formatError.js";

const empty = { name:"", type:"", habitat:"", cr:"", description:"", abilities:[], stats:{}, is_hidden:false };

export default function DMBestiary() {
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(empty);
  const [images, setImages] = useState([]);
  const [err, setErr] = useState("");
  const [portErr, setPortErr] = useState("");
  const [portMsg, setPortMsg] = useState("");
  const [portBusy, setPortBusy] = useState(false);
  const [portMode, setPortMode] = useState("merge");
  const [portMatch, setPortMatch] = useState("name");
  const [portOnExisting, setPortOnExisting] = useState("update");
  const [portImagesMeta, setPortImagesMeta] = useState(false);
  const [portPendingFile, setPortPendingFile] = useState(null);
  const [portPlan, setPortPlan] = useState(null);
  const fileRef = useRef(null);
  const importRef = useRef(null);
  const socket = useMemo(() => connectSocket({ role: "dm" }), []);

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await api.bestiary();
      setEnabled(!!r.enabled);
      setItems(r.items || []);
    } catch (e) {
      setErr(formatError(e));
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
    socket.on("bestiary:updated", () => load().catch(() => {}));
    socket.on("settings:updated", () => load().catch(() => {}));
    return () => socket.disconnect();
  }, [load, socket]);

  const loadImages = useCallback(async (monsterId) => {
    try {
      const r = await api.dmBestiaryImages(monsterId);
      setImages(r.items || []);
    } catch (e) {
      setImages([]);
      setErr(formatError(e));
    }
  }, []);

  function startNew() {
    setErr("");
    setEdit(null);
    setForm(empty);
    setImages([]);
    setOpen(true);
  }

  const startEdit = useCallback((m) => {
    setErr("");
    setEdit(m);
    const abilitiesText = Array.isArray(m.abilities)
      ? m.abilities.join("\n")
      : (typeof m.abilities === "string" ? m.abilities : "");
    setForm({ ...m, abilitiesText });
    setOpen(true);
    loadImages(m.id).catch(() => {});
  }, [loadImages]);

  async function save() {
    setErr("");
    const payload = { ...form, abilities: (form.abilitiesText || "").split("\n").map(s=>s.trim()).filter(Boolean) };
    delete payload.abilitiesText;
    try {
      if (edit) await api.dmBestiaryUpdate(edit.id, payload);
      else await api.dmBestiaryCreate(payload);
      setOpen(false);
      await load();
    } catch (e) {
      setErr(formatError(e));
    }
  }

  const del = useCallback(async (id) => {
    setErr("");
    try {
      await api.dmBestiaryDelete(id);
      await load();
    } catch (e) {
      setErr(formatError(e));
    }
  }, [load]);

  async function onPickFile(ev) {
    const f = ev.target.files?.[0];
    if (!f || !edit) return;
    setErr("");
    try {
      await api.dmBestiaryUploadImage(edit.id, f);
      await loadImages(edit.id);
    } catch (e) {
      setErr(formatError(e));
    } finally {
      ev.target.value = "";
    }
  }

  async function delImage(imageId) {
    if (!edit) return;
    setErr("");
    try {
      await api.dmBestiaryDeleteImage(imageId);
      await loadImages(edit.id);
    } catch (e) {
      setErr(formatError(e));
    }
  }

  async function toggleEnabled() {
    setErr("");
    try {
      await api.dmBestiaryToggle(!enabled);
      await load();
    } catch (e) {
      setErr(formatError(e));
    }
  }

  async function doExport() {
    setPortErr("");
    setPortMsg("");
    setPortBusy(true);
    try {
      const blob = await api.dmBestiaryExportJson(true);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bestiary_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPortMsg("Экспорт JSON готов.");
    } catch (e) {
      setPortErr(formatError(e));
    } finally {
      setPortBusy(false);
    }
  }

  async function runDryRun(file) {
    setPortErr("");
    setPortMsg("");
    setPortBusy(true);
    try {
      const r = await api.dmBestiaryImportJson(file, {
        mode: portMode,
        match: portMatch,
        onExisting: portOnExisting,
        imagesMeta: portImagesMeta,
        dryRun: true
      });
      setPortPlan(r);
      setPortMsg("Dry-run готов: проверьте план и нажмите «Применить».");
    } catch (e) {
      setPortPlan(null);
      setPortErr(formatError(e));
    } finally {
      setPortBusy(false);
    }
  }

  async function applyImport() {
    if (!portPendingFile) return;
    if (portMode === "replace") {
      const ok = window.confirm(
        `REPLACE удалит ${portPlan?.willDelete ?? "все"} существующих монстров (и очистит monster_images). Продолжить?`
      );
      if (!ok) return;
    }
    setPortErr("");
    setPortMsg("");
    setPortBusy(true);
    try {
      const r = await api.dmBestiaryImportJson(portPendingFile, {
        mode: portMode,
        match: portMatch,
        onExisting: portOnExisting,
        imagesMeta: portImagesMeta,
        dryRun: false
      });
      setPortMsg(`Импорт применён: created=${r.created}, updated=${r.updated}, skipped=${r.skipped}`);
      setPortPlan(null);
      setPortPendingFile(null);
      await load();
    } catch (e) {
      setPortErr(formatError(e));
    } finally {
      setPortBusy(false);
    }
  }

  function resetPlan() {
    setPortPlan(null);
    setPortPendingFile(null);
    setPortMsg("");
    setPortErr("");
  }

  async function onPickImport(ev) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    setPortPendingFile(file);
    await runDryRun(file);
  }

  const bestiaryRows = useMemo(() => items.map((m) => (
    <BestiaryRow key={m.id} item={m} onEdit={startEdit} onDelete={del} />
  )), [items, startEdit, del]);

  return (
    <div className="spread-grid">
      <div className="spread-col">
        <div className="card taped scrap-card paper-stack">
          <div style={{ fontWeight: 900, fontSize: 20 }}>Bestiary (DM)</div>
          <div className="small">Список существ и доступ для игроков</div>
          <hr />
          {err && <div className="badge off">Ошибка: {err}</div>}
          <div className="list">
            {bestiaryRows}
          </div>
        </div>
      </div>

      <div className="spread-col">
        <div className="card taped scrap-card">
          <div style={{ fontWeight: 800 }}>Управление</div>
          <div className="small">Экспорт / импорт / глобальная видимость</div>
          <hr />
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="btn secondary" onClick={toggleEnabled}>
              {enabled ? "Выключить для игроков" : "Включить для игроков"}
            </button>
            <button className="btn" onClick={startNew}>+ Добавить</button>
          </div>

          <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
            <button className="btn secondary" onClick={doExport} disabled={portBusy}>Export JSON</button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={onPickImport}
            />
            <button className="btn" onClick={() => importRef.current?.click()} disabled={portBusy}>Import JSON (dry-run)</button>
            <select value={portMode} onChange={(e) => setPortMode(e.target.value)} style={{ padding: 10, borderRadius: 12 }}>
              <option value="merge">merge</option>
              <option value="replace">replace</option>
            </select>
            <select value={portMatch} onChange={(e) => setPortMatch(e.target.value)} style={{ padding: 10, borderRadius: 12 }}>
              <option value="name">match: name</option>
              <option value="id">match: id</option>
            </select>
            <select value={portOnExisting} onChange={(e) => setPortOnExisting(e.target.value)} style={{ padding: 10, borderRadius: 12 }}>
              <option value="update">при совпадении: обновлять</option>
              <option value="skip">при совпадении: не трогать (skip)</option>
            </select>
            <label className="row" style={{ gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={portImagesMeta} onChange={(e) => setPortImagesMeta(e.target.checked)} />
              <span className="small">импортировать метаданные картинок</span>
            </label>
          </div>
          {portErr && <div className="badge off" style={{ marginTop: 10 }}>Ошибка: {portErr}</div>}
          {portMsg && <div className="badge ok" style={{ marginTop: 10 }}>{portMsg}</div>}
          {portPlan && (
            <div className="card taped" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 900 }}>Dry-run план</div>
              <div className="small" style={{ marginTop: 6 }}>
                mode={portPlan.mode}, match={portPlan.match}, onExisting={portPlan.onExisting}, imagesMeta={String(portPlan.imagesMeta)}
              </div>
              <div style={{ marginTop: 8 }}>
                <b>created:</b> {portPlan.created} &nbsp; <b>updated:</b> {portPlan.updated} &nbsp; <b>skipped:</b> {portPlan.skipped}
                {portPlan.mode === "replace" && <span> &nbsp; • <b>удалит существующих:</b> {portPlan.willDelete}</span>}
              </div>
              {Array.isArray(portPlan.warnings) && portPlan.warnings.length > 0 && (
                <div className="badge warn" style={{ display: "block", marginTop: 10 }}>
                  {portPlan.warnings.slice(0, 3).join(" • ")}
                </div>
              )}
              <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button className="btn" onClick={applyImport} disabled={portBusy || !portPendingFile}>Применить</button>
                <button className="btn secondary" onClick={() => portPendingFile && runDryRun(portPendingFile)} disabled={portBusy || !portPendingFile}>Пересчитать</button>
                <button className="btn secondary" onClick={resetPlan} disabled={portBusy}>Сбросить</button>
              </div>
              <div className="small" style={{ marginTop: 8 }}>
                Примеры: created={portPlan.samples?.created?.slice(0,5)?.join(", ") || "—"}<br />
                updated={portPlan.samples?.updated?.slice(0,5)?.join(", ") || "—"}<br />
                skipped={portPlan.samples?.skipped?.slice(0,5)?.join(", ") || "—"}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={open} title={edit ? "Редактировать" : "Новый монстр"} onClose={() => setOpen(false)}>
        <div className="list">
          {err && <div className="badge off">Ошибка: {err}</div>}
          <input value={form.name||""} onChange={(e)=>setForm({ ...form, name: e.target.value })} placeholder="Имя*" style={inp} />
          <div className="row">
            <input value={form.type||""} onChange={(e)=>setForm({ ...form, type: e.target.value })} placeholder="Тип" style={inp} />
            <input value={form.habitat||""} onChange={(e)=>setForm({ ...form, habitat: e.target.value })} placeholder="Среда" style={inp} />
          </div>
          <input value={form.cr||""} onChange={(e)=>setForm({ ...form, cr: e.target.value })} placeholder="CR (число/строка)" style={inp} />
          <textarea value={form.description||""} onChange={(e)=>setForm({ ...form, description: e.target.value })} placeholder="Описание (markdown)" rows={5} style={inp} />
          <textarea
            value={(form.abilitiesText ?? (Array.isArray(form.abilities) ? form.abilities.join("\n") : ""))}
            onChange={(e)=>setForm({ ...form, abilitiesText: e.target.value })}
            placeholder="Способности (по одной на строку)"
            rows={4}
            style={inp}
          />
          <label className="small">
            <input type="checkbox" checked={!!form.is_hidden} onChange={(e)=>setForm({ ...form, is_hidden: e.target.checked })} /> Скрыть для игроков (опц.)
          </label>
          <button className="btn" onClick={save}>Сохранить</button>

          <div style={{ marginTop: 10, fontWeight: 800 }}>Изображения</div>
          <div className="small">PNG/JPG/WEBP/GIF до 5MB</div>
          {!edit && <div className="small">Сначала сохраните монстра, чтобы загрузить картинки.</div>}

          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPickFile} />
            <button className="btn" onClick={() => fileRef.current?.click()} disabled={!edit}>+ Загрузить</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginTop: 12 }}>
            {images.map((img) => (
              <div key={img.id} className="item taped" style={{ flexDirection: "column", alignItems: "center" }}>
                <PolaroidFrame src={img.url} alt={img.originalName || "image"} fallback="IMG" className="lg" />
                <button className="btn danger" style={{ width: "100%", marginTop: 8 }} onClick={() => delImage(img.id)}>
                  Удалить
                </button>
              </div>
            ))}
            {edit && images.length === 0 && <div className="small">Пока нет изображений.</div>}
          </div>
        </div>
      </Modal>
    </div>
  );
}
const inp = { width: "100%" };

const BestiaryRow = React.memo(function BestiaryRow({ item, onEdit, onDelete }) {
  return (
    <div className="item taped" style={{ alignItems: "stretch", contentVisibility: "auto", containIntrinsicSize: "160px" }}>
      <PolaroidFrame src={item.images?.[0]?.url} alt={item.name} fallback="МОН" />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800 }}>
          {item.name} {item.is_hidden ? <span className="badge off">hidden</span> : null}
        </div>
        <div className="small">{item.type || "—"} • CR: {item.cr || "—"}</div>
      </div>
      <div className="row" style={{ flexDirection: "column", alignItems: "stretch" }}>
        <button className="btn secondary" onClick={() => onEdit(item)}>Ред.</button>
        <button className="btn danger" onClick={() => onDelete(item.id)}>Удал.</button>
      </div>
    </div>
  );
});
