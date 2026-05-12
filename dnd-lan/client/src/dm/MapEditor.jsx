import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

const LOCATION_CATEGORY_OPTIONS = [
  { value: "power", label: "Державы" },
  { value: "city", label: "Города" },
  { value: "resource", label: "Ресурсы" },
  { value: "anomaly", label: "Аномалии" }
];

const TOKEN_TYPE_OPTIONS = [
  { value: "", label: "Без типа" },
  { value: "npc", label: "NPC" },
  { value: "ally", label: "Союзник" },
  { value: "enemy", label: "Враг" },
  { value: "poi", label: "Точка интереса" }
];

function formatMapEditorError(error, fallback = "Не удалось обновить редактор карты.") {
  const raw = String(error?.message || error || "").trim().replace(/^Error:\s*/i, "");
  if (!raw) return fallback;
  if (raw === "payload_too_large") return "Файл слишком большой для загрузки.";
  if (raw === "unsupported_file_type") return "Поддерживаются только изображения PNG, JPG, WEBP и GIF.";
  if (raw === "upload_failed") return "Не удалось загрузить изображение карты.";
  if (raw === "no_file") return "Сначала выбери файл карты.";
  if (raw === "not_found") return "Запись карты уже не существует.";
  if (raw === "request_failed" || raw === "server_error") return fallback;
  if (raw.toUpperCase().includes("SQLITE_")) {
    return "Редактор карты временно недоступен. Проверь таблицы карты в базе данных.";
  }
  return raw;
}

function SectionHead({ eyebrow, title, count }) {
  return (
    <div className="dm-map-section-head">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h3>{title}</h3>
      </div>
      {typeof count === "number" ? <span className="badge secondary">{count}</span> : null}
    </div>
  );
}

function EmptyState({ children }) {
  return <div className="dm-map-empty-state">{children}</div>;
}

function LocationRow({ loc, onEdit, onDelete }) {
  return (
    <div className="map-editor-row">
      <div className="map-editor-row-main">
        <strong>{loc.name}</strong>
        <div className="muted">{loc.id} • {loc.category || "без категории"}</div>
      </div>
      <div className="map-editor-row-meta">
        <span className="badge secondary">x {Math.round(loc.defaultX ?? loc.default_x ?? 50)}</span>
        <span className="badge secondary">y {Math.round(loc.defaultY ?? loc.default_y ?? 50)}</span>
      </div>
      <div className="map-editor-row-actions">
        <button className="btn secondary" type="button" onClick={() => onEdit(loc)}>Редактировать</button>
        <button className="btn danger" type="button" onClick={() => onDelete(loc.id)}>Удалить</button>
      </div>
    </div>
  );
}

function TokenRow({ token, onEdit, onDelete }) {
  return (
    <div className="map-editor-row">
      <div className="map-editor-row-main">
        <strong>{token.name || `#${token.id}`}</strong>
        <div className="muted">{token.type || "без типа"}</div>
      </div>
      <div className="map-editor-row-meta">
        <span className="badge secondary">x {Math.round(token.x ?? 50)}</span>
        <span className="badge secondary">y {Math.round(token.y ?? 43)}</span>
      </div>
      <div className="map-editor-row-actions">
        <button className="btn secondary" type="button" onClick={() => onEdit(token)}>Редактировать</button>
        <button className="btn danger" type="button" onClick={() => onDelete(token.id)}>Удалить</button>
      </div>
    </div>
  );
}

function MapRow({ map, onActivate }) {
  return (
    <div className="map-editor-row">
      <div className="map-editor-row-main">
        <strong>{map.name || map.filename}</strong>
        <div className="muted">{map.width}×{map.height}</div>
      </div>
      <div className="map-editor-row-actions">
        <button className="btn secondary" type="button" onClick={() => onActivate(map.id)}>
          Активировать
        </button>
      </div>
    </div>
  );
}

export default function MapEditor({ embedded = false, onChanged = null }) {
  const [locations, setLocations] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingMap, setUploadingMap] = useState(false);
  const [error, setError] = useState("");
  const [selectedMapFileName, setSelectedMapFileName] = useState("");
  const [editing, setEditing] = useState(null);
  const [editingToken, setEditingToken] = useState(null);
  const [form, setForm] = useState({ name: "", id: "", category: "city", description: "", default_x: 50, default_y: 50, type: "" });

  const stats = useMemo(() => ([
    { label: "Карт", value: maps.length },
    { label: "Локаций", value: locations.length },
    { label: "Жетонов", value: tokens.length }
  ]), [locations.length, maps.length, tokens.length]);

  const resetLocationForm = () => {
    setForm({ name: "", id: "", category: "city", description: "", default_x: 50, default_y: 50, type: "" });
  };

  const resetTokenForm = () => {
    setForm({ name: "", id: "", category: "city", description: "", default_x: 50, default_y: 50, type: "npc" });
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [locs, toks, ms] = await Promise.all([
        api.dmListLocations(),
        api.dmListTokens(),
        api.dmListMaps()
      ]);
      setLocations(Array.isArray(locs?.locations) ? locs.locations : []);
      setTokens(Array.isArray(toks?.tokens) ? toks.tokens : []);
      setMaps(Array.isArray(ms?.maps) ? ms.maps : []);
    } catch (err) {
      setError(formatMapEditorError(err, "Не удалось загрузить данные редактора карты."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const syncAfterChange = async () => {
    await load();
    if (typeof onChanged === "function") await onChanged();
  };

  const startCreateLocation = () => {
    setEditing("new");
    setEditingToken(null);
    resetLocationForm();
  };

  const startEditLocation = (loc) => {
    setEditing(loc.id);
    setEditingToken(null);
    setForm({
      name: loc.name || "",
      id: loc.id || "",
      category: loc.category || "city",
      description: loc.description || "",
      default_x: loc.defaultX ?? loc.default_x ?? 50,
      default_y: loc.defaultY ?? loc.default_y ?? 50,
      type: ""
    });
  };

  const startCreateToken = () => {
    setEditing(null);
    setEditingToken("new");
    resetTokenForm();
  };

  const startEditToken = (token) => {
    setEditing(null);
    setEditingToken(token.id);
    setForm({
      name: token.name || "",
      id: token.id,
      category: "city",
      description: "",
      default_x: token.x ?? 50,
      default_y: token.y ?? 43,
      type: token.type || ""
    });
  };

  const saveLocation = async () => {
    const payload = {
      name: String(form.name || "").trim(),
      id: String(form.id || "").trim(),
      category: String(form.category || "").trim(),
      description: String(form.description || ""),
      default_x: Number(form.default_x),
      default_y: Number(form.default_y)
    };
    if (!payload.name) {
      setError("Укажи название локации.");
      return;
    }
    if (editing === "new" && !payload.id) {
      setError("Укажи уникальный id локации.");
      return;
    }
    try {
      setError("");
      if (editing === "new") {
        await api.dmCreateLocation(payload);
      } else {
        await api.dmUpdateLocation(editing, payload);
      }
      await syncAfterChange();
      setEditing(null);
      resetLocationForm();
    } catch (err) {
      setError(formatMapEditorError(err, "Не удалось сохранить локацию."));
    }
  };

  const saveToken = async () => {
    const payload = {
      name: String(form.name || "").trim(),
      type: String(form.type || "").trim() || null,
      x: Number(form.default_x),
      y: Number(form.default_y)
    };
    if (!payload.name) {
      setError("Укажи имя жетона.");
      return;
    }
    try {
      setError("");
      if (editingToken === "new") {
        await api.dmCreateToken(payload);
      } else if (editingToken) {
        await api.dmUpdateToken(editingToken, payload);
      }
      await syncAfterChange();
      setEditingToken(null);
      resetTokenForm();
    } catch (err) {
      setError(formatMapEditorError(err, "Не удалось сохранить жетон."));
    }
  };

  const removeLocation = async (id) => {
    if (!confirm("Удалить локацию?")) return;
    try {
      setError("");
      await api.dmDeleteLocation(id);
      await syncAfterChange();
    } catch (err) {
      setError(formatMapEditorError(err, "Не удалось удалить локацию."));
    }
  };

  const removeToken = async (id) => {
    if (!confirm("Удалить жетон?")) return;
    try {
      setError("");
      await api.dmDeleteToken(id);
      await syncAfterChange();
    } catch (err) {
      setError(formatMapEditorError(err, "Не удалось удалить жетон."));
    }
  };

  const activateMap = async (id) => {
    try {
      setError("");
      await api.dmActivateMap(id);
      await syncAfterChange();
    } catch (err) {
      setError(formatMapEditorError(err, "Не удалось активировать карту."));
    }
  };

  const handleMapUpload = async (event) => {
    const file = event.target.files?.[0];
    setSelectedMapFileName(file?.name || "");
    if (!file) return;
    try {
      setUploadingMap(true);
      setError("");
      const response = await api.dmUploadMap(file, file.name);
      if (response?.map?.id) await api.dmActivateMap(response.map.id);
      await syncAfterChange();
      setSelectedMapFileName("");
    } catch (err) {
      setError(formatMapEditorError(err, "Не удалось загрузить карту."));
    } finally {
      setUploadingMap(false);
      event.target.value = "";
    }
  };

  return (
    <div className={`dm-map-editor${embedded ? " is-embedded" : ""}`}>
      <section className="card dm-map-editor-hero">
        <div className="dm-map-editor-copy">
          <div className="eyebrow">DM Tools</div>
          <h2>{embedded ? "Редактор карты" : "Картограф"}</h2>
          <p className="muted">Карты, локации и жетоны теперь собраны в одной рабочей панели без лишних переходов.</p>
        </div>
        <div className="dm-map-editor-stats">
          {stats.map((stat) => (
            <div key={stat.label} className="dm-map-editor-stat">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {error ? <div className="world-map-inline-error">{error}</div> : null}

      <div className="dm-map-editor-actions">
        <button className="btn primary" type="button" onClick={startCreateLocation}>Новая локация</button>
        <button className="btn secondary" type="button" onClick={startCreateToken}>Новый жетон</button>
        <button className="btn secondary" type="button" onClick={load} disabled={loading || uploadingMap}>
          {loading ? "Обновляю..." : "Обновить"}
        </button>
      </div>

      <section className="card">
        <SectionHead eyebrow="Фон сцены" title="Карты" count={maps.length} />
        <p className="muted">Загрузи изображение и оно сразу станет активной картой для текущей партии.</p>
        <label className="dm-map-upload">
          <span className="dm-map-upload-button">{uploadingMap ? "Загружаю..." : "Выбрать карту"}</span>
          <span className={`dm-map-upload-name${selectedMapFileName ? " has-file" : ""}`}>
            {selectedMapFileName || "PNG, JPG, WEBP или GIF"}
          </span>
          <input type="file" accept="image/*" disabled={uploadingMap} onChange={handleMapUpload} />
        </label>
        <div className="dm-map-editor-list">
          {maps.length === 0 ? <EmptyState>Нет загруженных карт</EmptyState> : maps.map((map) => (
            <MapRow key={map.id} map={map} onActivate={activateMap} />
          ))}
        </div>
      </section>

      <section className="card">
        <SectionHead eyebrow="Точки интереса" title="Локации" count={locations.length} />
        <div className="dm-map-editor-list">
          {locations.length === 0 ? <EmptyState>Нет локаций</EmptyState> : locations.map((loc) => (
            <LocationRow key={loc.id} loc={loc} onEdit={startEditLocation} onDelete={removeLocation} />
          ))}
        </div>
      </section>

      <section className="card">
        <SectionHead eyebrow="Фигуры на карте" title="Жетоны" count={tokens.length} />
        <div className="dm-map-editor-list">
          {tokens.length === 0 ? <EmptyState>Нет жетонов</EmptyState> : tokens.map((token) => (
            <TokenRow key={token.id} token={token} onEdit={startEditToken} onDelete={removeToken} />
          ))}
        </div>
      </section>

      {editing ? (
        <aside className="card dm-map-editor-sheet">
          <SectionHead eyebrow="Редактирование" title={editing === "new" ? "Новая локация" : `Локация ${editing}`} />
          <div className="dm-map-form-grid">
            <label>
              Название
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Id
              <input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} disabled={editing !== "new"} />
            </label>
            <label>
              Категория
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {LOCATION_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              X
              <input type="number" min="0" max="100" value={form.default_x} onChange={(e) => setForm({ ...form, default_x: Number(e.target.value) })} />
            </label>
            <label>
              Y
              <input type="number" min="0" max="100" value={form.default_y} onChange={(e) => setForm({ ...form, default_y: Number(e.target.value) })} />
            </label>
            <label className="dm-map-form-span-2">
              Описание
              <textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
          </div>
          <div className="dm-map-editor-form-actions">
            <button className="btn primary" type="button" onClick={saveLocation}>Сохранить</button>
            <button className="btn secondary" type="button" onClick={() => setEditing(null)}>Отмена</button>
          </div>
        </aside>
      ) : null}

      {editingToken ? (
        <aside className="card dm-map-editor-sheet">
          <SectionHead eyebrow="Редактирование" title={editingToken === "new" ? "Новый жетон" : `Жетон #${editingToken}`} />
          <div className="dm-map-form-grid">
            <label>
              Имя
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Тип
              <select value={form.type || ""} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TOKEN_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              X
              <input type="number" min="0" max="100" value={form.default_x} onChange={(e) => setForm({ ...form, default_x: Number(e.target.value) })} />
            </label>
            <label>
              Y
              <input type="number" min="0" max="100" value={form.default_y} onChange={(e) => setForm({ ...form, default_y: Number(e.target.value) })} />
            </label>
          </div>
          <div className="dm-map-editor-form-actions">
            <button className="btn primary" type="button" onClick={saveToken}>Сохранить</button>
            <button className="btn secondary" type="button" onClick={() => setEditingToken(null)}>Отмена</button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
