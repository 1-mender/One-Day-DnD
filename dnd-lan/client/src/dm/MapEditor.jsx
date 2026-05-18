import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

const LOCATION_CATEGORY_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "power", label: "Державы" },
  { value: "city", label: "Города" },
  { value: "resource", label: "Ресурсы" },
  { value: "anomaly", label: "Аномалии" }
];

const TOKEN_TYPE_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "", label: "Без типа" },
  { value: "npc", label: "NPC" },
  { value: "ally", label: "Союзник" },
  { value: "enemy", label: "Враг" },
  { value: "poi", label: "Точка интереса" }
];

const SECTION_OPTIONS = [
  { key: "maps", label: "Карты" },
  { key: "locations", label: "Локации" },
  { key: "tokens", label: "Жетоны" }
];

const SECTION_ROW_LIMITS = {
  maps: 6,
  locations: 6,
  tokens: 8
};

const LOCATION_CATEGORY_LABELS = Object.fromEntries(LOCATION_CATEGORY_OPTIONS.map((option) => [option.value, option.label]));
const TOKEN_TYPE_LABELS = Object.fromEntries(TOKEN_TYPE_OPTIONS.map((option) => [option.value, option.label]));
const DEFAULT_MAP_UPLOAD_SETTINGS = {
  maxBytes: 10 * 1024 * 1024,
  maxMegabytes: 10,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"]
};

function formatMapEditorError(error, fallback = "Не удалось обновить редактор карты.") {
  const raw = String(error?.message || error || "").trim().replace(/^Error:\s*/i, "");
  if (!raw) return fallback;
  if (raw === "payload_too_large" || raw === "file_too_large") return "Файл слишком большой для загрузки.";
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

function normalizeSearchValue(value) {
  return String(value || "").trim().toLowerCase();
}

function matchesSearch(parts, query) {
  if (!query) return true;
  return parts.some((part) => normalizeSearchValue(part).includes(query));
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "не задано";
  if (value >= 1024 * 1024) return `${Number((value / (1024 * 1024)).toFixed(1))} МБ`;
  if (value >= 1024) return `${Math.round(value / 1024)} КБ`;
  return `${value} Б`;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatMimeLabel(mime) {
  switch (String(mime || "").toLowerCase()) {
    case "image/jpeg":
      return "JPG";
    case "image/png":
      return "PNG";
    case "image/webp":
      return "WEBP";
    case "image/gif":
      return "GIF";
    default:
      return String(mime || "").replace(/^image\//i, "").toUpperCase();
  }
}

function getMapUploadSettings(info) {
  const raw = info?.settings?.mapUpload;
  if (!raw) return DEFAULT_MAP_UPLOAD_SETTINGS;
  const maxBytes = Number(raw.maxBytes || DEFAULT_MAP_UPLOAD_SETTINGS.maxBytes);
  const maxMegabytes = Number(raw.maxMegabytes || (maxBytes / (1024 * 1024)).toFixed(1));
  const allowedMimeTypes = Array.isArray(raw.allowedMimeTypes) && raw.allowedMimeTypes.length
    ? raw.allowedMimeTypes
    : DEFAULT_MAP_UPLOAD_SETTINGS.allowedMimeTypes;
  return { maxBytes, maxMegabytes, allowedMimeTypes };
}

function buildCountLabel(total, visible, filtered) {
  return filtered ? `${visible}/${total}` : total;
}

function truncateText(value, max = 88) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function getVisibleRows(items, section, expanded) {
  if (expanded) return items;
  return items.slice(0, SECTION_ROW_LIMITS[section] || items.length);
}

function EmptyState({ children }) {
  return <div className="dm-map-empty-state">{children}</div>;
}

function SectionTitle({ eyebrow, title, detail, count }) {
  return (
    <div className="dm-map-section-head">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h3>{title}</h3>
        {detail ? <p className="dm-map-section-note muted">{detail}</p> : null}
      </div>
      {count != null ? <span className="badge secondary">{count}</span> : null}
    </div>
  );
}

function MapRow({ map, isActive, onActivate, onDelete, deleting, activating }) {
  return (
    <div className={`map-editor-row map-editor-row-compact${isActive ? " is-active" : ""}`}>
      <div className="map-editor-row-main">
        <div className="map-editor-row-main-head">
          <strong>{map.name || map.filename}</strong>
          <div className="map-editor-row-inline">
            <span className={`badge ${isActive ? "ok" : "secondary"}`}>{isActive ? "Активна" : "Карта"}</span>
            <span className="badge secondary">{map.width}×{map.height}</span>
          </div>
        </div>
        <div className="map-editor-row-subline">
          {map.filename ? <span title={map.filename}>{truncateText(map.filename, 72)}</span> : null}
          {map.updatedAt ? <span>Обновлена {formatDateTime(map.updatedAt)}</span> : null}
        </div>
      </div>
      <div className="map-editor-row-actions">
        <a className="btn secondary" href={map.url} target="_blank" rel="noreferrer">Открыть</a>
        <button className="btn secondary" type="button" onClick={() => onActivate(map.id)} disabled={isActive || deleting || activating}>
          {activating ? "..." : isActive ? "Активна" : "Включить"}
        </button>
        <button className="btn danger" type="button" onClick={() => onDelete(map)} disabled={deleting || activating}>
          {deleting ? "Удаляю..." : "Удалить"}
        </button>
      </div>
    </div>
  );
}

function LocationRow({ loc, onEdit, onDelete }) {
  const categoryLabel = LOCATION_CATEGORY_LABELS[loc.category] || loc.category || "Без категории";
  return (
    <div className="map-editor-row map-editor-row-compact">
      <div className="map-editor-row-main">
        <div className="map-editor-row-main-head">
          <strong>{loc.name}</strong>
          <div className="map-editor-row-inline">
            <span className="badge secondary">{categoryLabel}</span>
            <span className="badge secondary">{loc.id}</span>
            <span className="badge secondary">x {Math.round(loc.defaultX ?? loc.default_x ?? 50)}</span>
            <span className="badge secondary">y {Math.round(loc.defaultY ?? loc.default_y ?? 50)}</span>
          </div>
        </div>
        <div className="map-editor-row-description" title={loc.description || ""}>
          {loc.description || "Без описания"}
        </div>
      </div>
      <div className="map-editor-row-actions">
        <button className="btn secondary" type="button" onClick={() => onEdit(loc)}>Редактировать</button>
        <button className="btn danger" type="button" onClick={() => onDelete(loc.id)}>Удалить</button>
      </div>
    </div>
  );
}

function TokenRow({ token, onEdit, onDelete }) {
  const tokenLabel = TOKEN_TYPE_LABELS[token.type || ""] || token.type || "Без типа";
  return (
    <div className="map-editor-row map-editor-row-compact">
      <div className="map-editor-row-main">
        <div className="map-editor-row-main-head">
          <strong>{token.name || `#${token.id}`}</strong>
          <div className="map-editor-row-inline">
            <span className="badge secondary">{tokenLabel}</span>
            <span className="badge secondary">x {Math.round(token.x ?? 50)}</span>
            <span className="badge secondary">y {Math.round(token.y ?? 43)}</span>
          </div>
        </div>
        <div className="map-editor-row-subline">
          <span>Жетон #{token.id}</span>
          {token.updatedAt ? <span>Обновлён {formatDateTime(token.updatedAt)}</span> : null}
        </div>
      </div>
      <div className="map-editor-row-actions">
        <button className="btn secondary" type="button" onClick={() => onEdit(token)}>Редактировать</button>
        <button className="btn danger" type="button" onClick={() => onDelete(token.id)}>Удалить</button>
      </div>
    </div>
  );
}

function SectionFooter({ section, total, visible, expanded, onToggle }) {
  if (total <= visible) return null;
  return (
    <div className="dm-map-section-footer">
      <button className="btn secondary" type="button" onClick={() => onToggle(section)}>
        {expanded ? "Свернуть" : `Показать ещё (${total - visible})`}
      </button>
    </div>
  );
}

export default function MapEditor({ embedded = false, onChanged = null }) {
  const [locations, setLocations] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [maps, setMaps] = useState([]);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingMap, setUploadingMap] = useState(false);
  const [activatingMapId, setActivatingMapId] = useState(null);
  const [deletingMapId, setDeletingMapId] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState("maps");
  const [locationFilter, setLocationFilter] = useState("all");
  const [tokenFilter, setTokenFilter] = useState("all");
  const [expandedSections, setExpandedSections] = useState({
    maps: false,
    locations: false,
    tokens: false
  });
  const [selectedMapFileName, setSelectedMapFileName] = useState("");
  const [editing, setEditing] = useState(null);
  const [editingToken, setEditingToken] = useState(null);
  const [form, setForm] = useState({ name: "", id: "", category: "city", description: "", default_x: 50, default_y: 50, type: "" });

  const activeMap = maps[0] || null;
  const mapUpload = useMemo(() => getMapUploadSettings(info), [info]);
  const uploadFormatLabels = useMemo(
    () => [...new Set(mapUpload.allowedMimeTypes.map(formatMimeLabel).filter(Boolean))],
    [mapUpload.allowedMimeTypes]
  );
  const normalizedQuery = useMemo(() => normalizeSearchValue(query), [query]);
  const filteredMaps = useMemo(
    () => maps.filter((map) => matchesSearch([map.name, map.filename, map.width, map.height], normalizedQuery)),
    [maps, normalizedQuery]
  );
  const filteredLocations = useMemo(
    () => locations.filter((location) => {
      if (locationFilter !== "all" && location.category !== locationFilter) return false;
      return matchesSearch([
        location.name,
        location.id,
        location.category,
        LOCATION_CATEGORY_LABELS[location.category],
        location.description
      ], normalizedQuery);
    }),
    [locationFilter, locations, normalizedQuery]
  );
  const filteredTokens = useMemo(
    () => tokens.filter((token) => {
      if (tokenFilter !== "all" && String(token.type || "") !== tokenFilter) return false;
      return matchesSearch([
        token.name,
        token.id,
        token.type,
        TOKEN_TYPE_LABELS[token.type || ""]
      ], normalizedQuery);
    }),
    [normalizedQuery, tokenFilter, tokens]
  );
  const visibleMaps = useMemo(
    () => getVisibleRows(filteredMaps, "maps", expandedSections.maps || normalizedQuery),
    [expandedSections.maps, filteredMaps, normalizedQuery]
  );
  const visibleLocations = useMemo(
    () => getVisibleRows(filteredLocations, "locations", expandedSections.locations || normalizedQuery || locationFilter !== "all"),
    [expandedSections.locations, filteredLocations, locationFilter, normalizedQuery]
  );
  const visibleTokens = useMemo(
    () => getVisibleRows(filteredTokens, "tokens", expandedSections.tokens || normalizedQuery || tokenFilter !== "all"),
    [expandedSections.tokens, filteredTokens, normalizedQuery, tokenFilter]
  );
  const sectionCounts = useMemo(() => ({
    maps: filteredMaps.length,
    locations: filteredLocations.length,
    tokens: filteredTokens.length
  }), [filteredLocations.length, filteredMaps.length, filteredTokens.length]);

  const resetLocationForm = () => {
    setForm({ name: "", id: "", category: "city", description: "", default_x: 50, default_y: 50, type: "" });
  };

  const resetTokenForm = () => {
    setForm({ name: "", id: "", category: "city", description: "", default_x: 50, default_y: 50, type: "npc" });
  };

  const setPresetPosition = (x, y) => {
    setForm((current) => ({ ...current, default_x: x, default_y: y }));
  };

  const toggleExpandedSection = (section) => {
    setExpandedSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [locs, toks, ms, serverInfo] = await Promise.all([
        api.dmListLocations(),
        api.dmListTokens(),
        api.dmListMaps(),
        api.serverInfo().catch(() => null)
      ]);
      setLocations(Array.isArray(locs?.locations) ? locs.locations : []);
      setTokens(Array.isArray(toks?.tokens) ? toks.tokens : []);
      setMaps(Array.isArray(ms?.maps) ? ms.maps : []);
      if (serverInfo) setInfo(serverInfo);
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
    setActiveSection("locations");
    setEditing("new");
    setEditingToken(null);
    resetLocationForm();
  };

  const startEditLocation = (loc) => {
    setActiveSection("locations");
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
    setActiveSection("tokens");
    setEditing(null);
    setEditingToken("new");
    resetTokenForm();
  };

  const startEditToken = (token) => {
    setActiveSection("tokens");
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
    setActivatingMapId(id);
    try {
      setError("");
      await api.dmActivateMap(id);
      await syncAfterChange();
    } catch (err) {
      setError(formatMapEditorError(err, "Не удалось активировать карту."));
    } finally {
      setActivatingMapId(null);
    }
  };

  const removeMap = async (map) => {
    const isActive = map?.id === activeMap?.id;
    const question = isActive
      ? "Удалить активную карту? После удаления партия переключится на следующую доступную карту или на встроенную карту мира."
      : "Удалить загруженную карту?";
    if (!confirm(question)) return;

    setDeletingMapId(map.id);
    try {
      setError("");
      await api.dmDeleteMap(map.id);
      await syncAfterChange();
    } catch (err) {
      setError(formatMapEditorError(err, "Не удалось удалить карту."));
    } finally {
      setDeletingMapId(null);
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
      setActiveSection("maps");
      await syncAfterChange();
      setSelectedMapFileName("");
    } catch (err) {
      setError(formatMapEditorError(err, "Не удалось загрузить карту."));
    } finally {
      setUploadingMap(false);
      event.target.value = "";
    }
  };

  const sectionDetail = activeSection === "maps"
    ? `Активна: ${activeMap?.name || "встроенная карта"}`
    : activeSection === "locations"
      ? `${locations.length} точек интереса`
      : `${tokens.length} жетонов на сцене`;

  return (
    <div className={`dm-map-editor${embedded ? " is-embedded" : ""}`}>
      <section className="card dm-map-editor-hero dm-map-editor-hero-compact">
        <div className="dm-map-editor-copy">
          <div className="eyebrow">DM Tools</div>
          <h2>{embedded ? "Редактор карты" : "Картограф"}</h2>
          <div className="dm-map-editor-subline">
            <span><b>{activeMap?.name || "Встроенная карта мира"}</b></span>
            <span>{activeMap ? `${activeMap.width}×${activeMap.height}` : "1024×1024"}</span>
            <span>{sectionDetail}</span>
          </div>
        </div>

        <div className="dm-map-editor-head-actions">
          <button className="btn secondary" type="button" onClick={load} disabled={loading || uploadingMap}>
            {loading ? "Обновляю..." : "Обновить"}
          </button>
          {normalizedQuery ? (
            <button className="btn secondary" type="button" onClick={() => setQuery("")}>Сбросить поиск</button>
          ) : null}
        </div>

        <div className="dm-map-editor-summary-row">
          <span className="badge ok">{maps.length ? `${maps.length} карт` : "Базовая карта"}</span>
          <span className="badge secondary">{locations.length} локаций</span>
          <span className="badge secondary">{tokens.length} жетонов</span>
          <span className="badge secondary">Лимит {mapUpload.maxMegabytes} МБ</span>
          {uploadFormatLabels.map((label) => (
            <span key={label} className="badge secondary">{label}</span>
          ))}
        </div>

        <div className="dm-map-editor-toolbar">
          <div className="profile-view-switch profile-view-switch-three dm-map-editor-tabs">
            {SECTION_OPTIONS.map((section) => (
              <button
                key={section.key}
                type="button"
                className={`profile-view-tab${activeSection === section.key ? " profile-view-tab-active" : ""}`}
                onClick={() => setActiveSection(section.key)}
              >
                <span className="profile-view-tab-label">{section.label}</span>
                <span className="badge secondary">{sectionCounts[section.key]}</span>
              </button>
            ))}
          </div>

          <label className="dm-map-editor-search">
            <span className="small note-hint">Поиск</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={activeSection === "maps" ? "Название или файл карты" : activeSection === "locations" ? "Локация, id или описание" : "Имя или тип жетона"}
              aria-label="Поиск по редактору карты"
            />
          </label>
        </div>

        {activeSection === "locations" ? (
          <div className="dm-map-editor-chip-row">
            {LOCATION_CATEGORY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`world-map-state-btn${locationFilter === option.value ? " active" : ""}`}
                onClick={() => setLocationFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

        {activeSection === "tokens" ? (
          <div className="dm-map-editor-chip-row">
            {TOKEN_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value || "none"}
                type="button"
                className={`world-map-state-btn${tokenFilter === option.value ? " active" : ""}`}
                onClick={() => setTokenFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {error ? <div className="world-map-inline-error">{error}</div> : null}

      <div className="dm-map-editor-actions">
        <button className={`btn ${activeSection === "locations" ? "primary" : "secondary"}`} type="button" onClick={startCreateLocation}>
          Новая локация
        </button>
        <button className={`btn ${activeSection === "tokens" ? "primary" : "secondary"}`} type="button" onClick={startCreateToken}>
          Новый жетон
        </button>
      </div>

      {activeSection === "maps" ? (
        <section className="card">
          <SectionTitle
            eyebrow="Фон сцены"
            title="Библиотека карт"
            count={buildCountLabel(maps.length, filteredMaps.length, Boolean(normalizedQuery))}
            detail="Здесь только загрузка, быстрый просмотр, активация и удаление карт."
          />
          <label className="dm-map-upload">
            <span className="dm-map-upload-button">{uploadingMap ? "Загружаю..." : "Загрузить карту"}</span>
            <span className={`dm-map-upload-name${selectedMapFileName ? " has-file" : ""}`}>
              {selectedMapFileName || `До ${formatBytes(mapUpload.maxBytes)} • ${uploadFormatLabels.join(", ")}`}
            </span>
            <input type="file" accept={mapUpload.allowedMimeTypes.join(",")} disabled={uploadingMap} onChange={handleMapUpload} />
          </label>
          <div className="dm-map-editor-list">
            {maps.length === 0 ? (
              <EmptyState>Пока нет загруженных карт. Игрокам показывается встроенная карта мира.</EmptyState>
            ) : filteredMaps.length === 0 ? (
              <EmptyState>По текущему поиску карт не найдено.</EmptyState>
            ) : visibleMaps.map((map) => (
              <MapRow
                key={map.id}
                map={map}
                isActive={map.id === activeMap?.id}
                onActivate={activateMap}
                onDelete={removeMap}
                deleting={deletingMapId === map.id}
                activating={activatingMapId === map.id}
              />
            ))}
          </div>
          <SectionFooter
            section="maps"
            total={filteredMaps.length}
            visible={visibleMaps.length}
            expanded={!!expandedSections.maps}
            onToggle={toggleExpandedSection}
          />
        </section>
      ) : null}

      {activeSection === "locations" ? (
        <section className="card">
          <SectionTitle
            eyebrow="Точки интереса"
            title="Локации"
            count={buildCountLabel(locations.length, filteredLocations.length, Boolean(normalizedQuery) || locationFilter !== "all")}
            detail="Описание в списке укорочено, чтобы навигация не раздувала панель. Полный текст открывается в редактировании."
          />
          <div className="dm-map-editor-list">
            {locations.length === 0 ? (
              <EmptyState>Нет локаций</EmptyState>
            ) : filteredLocations.length === 0 ? (
              <EmptyState>По текущим фильтрам локаций не найдено.</EmptyState>
            ) : visibleLocations.map((loc) => (
              <LocationRow key={loc.id} loc={loc} onEdit={startEditLocation} onDelete={removeLocation} />
            ))}
          </div>
          <SectionFooter
            section="locations"
            total={filteredLocations.length}
            visible={visibleLocations.length}
            expanded={!!expandedSections.locations}
            onToggle={toggleExpandedSection}
          />
        </section>
      ) : null}

      {activeSection === "tokens" ? (
        <section className="card">
          <SectionTitle
            eyebrow="Фигуры на карте"
            title="Жетоны"
            count={buildCountLabel(tokens.length, filteredTokens.length, Boolean(normalizedQuery) || tokenFilter !== "all")}
            detail="Жетоны вынесены в отдельную вкладку, чтобы не мешать картам и локациям."
          />
          <div className="dm-map-editor-list">
            {tokens.length === 0 ? (
              <EmptyState>Нет жетонов</EmptyState>
            ) : filteredTokens.length === 0 ? (
              <EmptyState>По текущим фильтрам жетонов не найдено.</EmptyState>
            ) : visibleTokens.map((token) => (
              <TokenRow key={token.id} token={token} onEdit={startEditToken} onDelete={removeToken} />
            ))}
          </div>
          <SectionFooter
            section="tokens"
            total={filteredTokens.length}
            visible={visibleTokens.length}
            expanded={!!expandedSections.tokens}
            onToggle={toggleExpandedSection}
          />
        </section>
      ) : null}

      {editing ? (
        <aside className="card dm-map-editor-sheet">
          <SectionTitle eyebrow="Редактирование" title={editing === "new" ? "Новая локация" : `Локация ${editing}`} />
          <div className="dm-map-form-grid">
            <label>
              Название
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label>
              Id
              <input value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} disabled={editing !== "new"} />
            </label>
            <label>
              Категория
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                {LOCATION_CATEGORY_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              X
              <input type="number" min="0" max="100" value={form.default_x} onChange={(event) => setForm({ ...form, default_x: Number(event.target.value) })} />
            </label>
            <label>
              Y
              <input type="number" min="0" max="100" value={form.default_y} onChange={(event) => setForm({ ...form, default_y: Number(event.target.value) })} />
            </label>
            <div className="dm-map-form-span-2 dm-map-position-presets">
              <button className="btn secondary" type="button" onClick={() => setPresetPosition(50, 50)}>В центр карты</button>
              <span className="muted">Координаты задаются в процентах от 0 до 100.</span>
            </div>
            <label className="dm-map-form-span-2">
              Описание
              <textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
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
          <SectionTitle eyebrow="Редактирование" title={editingToken === "new" ? "Новый жетон" : `Жетон #${editingToken}`} />
          <div className="dm-map-form-grid">
            <label>
              Имя
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label>
              Тип
              <select value={form.type || ""} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                {TOKEN_TYPE_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                  <option key={option.value || "none"} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              X
              <input type="number" min="0" max="100" value={form.default_x} onChange={(event) => setForm({ ...form, default_x: Number(event.target.value) })} />
            </label>
            <label>
              Y
              <input type="number" min="0" max="100" value={form.default_y} onChange={(event) => setForm({ ...form, default_y: Number(event.target.value) })} />
            </label>
            <div className="dm-map-form-span-2 dm-map-position-presets">
              <button className="btn secondary" type="button" onClick={() => setPresetPosition(50, 50)}>В центр карты</button>
              <span className="muted">Координаты задаются в процентах от 0 до 100.</span>
            </div>
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
