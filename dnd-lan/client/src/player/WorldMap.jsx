import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Fullscreen, Minimize, RefreshCcw } from "lucide-react";
import "./WorldMap.css";
import { api } from "../api.js";
import { useSocket } from "../context/SocketContext.jsx";
import { getClassPathLabel } from "./classCatalog.js";
import { formatReputationLabel } from "./profileDomain.js";
import {
  WORLD_MAP_CATEGORY_LABELS,
  WORLD_MAP_LOCATIONS,
  WORLD_MAP_SIZE
} from "./worldMapLocations.js";
import {
  resolveWorldMapDimensions,
  resolveWorldMapImageUrl,
  WORLD_MAP_SOCKET_EVENTS
} from "./worldMapDomain.js";

const DMMapEditor = lazy(() => import("../dm/MapEditor.jsx"));

// Базовые статические настройки для инициализации
const MAP_PADDED_BOUNDS = [[-96, -96], [WORLD_MAP_SIZE + 96, WORLD_MAP_SIZE + 96]];
const LOCATION_VISIBILITY_LABELS = {
  hidden: "Скрыта",
  known: "Известна",
  active: "Активна",
  completed: "Пройдена"
};

function formatMapUiError(error, fallback = "Не удалось загрузить карту") {
  const raw = String(error?.message || error || "").trim().replace(/^Error:\s*/i, "");
  if (!raw) return fallback;
  if (raw === "not_authenticated") return "Нужна авторизация для доступа к карте.";
  if (raw === "request_failed" || raw === "server_error") return fallback;
  if (raw === "invalid_json") return "Сервер вернул повреждённый ответ.";
  if (raw.toUpperCase().includes("SQLITE_")) {
    return "Данные карты сейчас недоступны. Проверь базу данных модуля карты.";
  }
  return raw;
}

function coerceMapCoordinate(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

// === ОБНОВЛЕННАЯ ФУНКЦИЯ КООРДИНАТ: Принимает динамические размеры ===
function toMapLatLng(x, y, dimensions) {
  const h = dimensions?.height || WORLD_MAP_SIZE;
  const w = dimensions?.width || WORLD_MAP_SIZE;
  return [h - (y / 100) * h, (x / 100) * w];
}

function getCoverZoom(map, dimensions) {
  const size = map.getSize();
  const h = dimensions?.height || WORLD_MAP_SIZE;
  const w = dimensions?.width || WORLD_MAP_SIZE;
  if (!size.x || !size.y) return 0;
  return Math.max(
    Math.log2(size.x / w),
    Math.log2(size.y / h)
  );
}

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;
}

function getPlayerName(player) {
  return player?.publicProfile?.characterName || player?.displayName || `Игрок #${player?.id ?? "?"}`;
}

function getPlayerInitial(player) {
  return String(getPlayerName(player)).trim().slice(0, 1).toUpperCase() || "?";
}

// Экранирование HTML тегов для защиты
function escapeMarkerHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function makeLocationIcon(location, selected) {
  const mobile = isMobileViewport();
  const size = mobile ? [40, 40] : [28, 28];
  const anchor = mobile ? [20, 20] : [14, 14];
  return L.divIcon({
    className: "",
    html: `<span class="world-map-marker world-map-marker-${location.category} world-map-marker-${location.visibility || "known"}${selected ? " is-selected" : ""}" aria-hidden="true"></span>`,
    iconSize: size,
    iconAnchor: anchor
  });
}

function makePlayerIcon(player, selected) {
  const name = escapeMarkerHtml(getPlayerName(player));
  const avatar = escapeMarkerHtml(player?.publicProfile?.avatarUrl);
  const initial = escapeMarkerHtml(getPlayerInitial(player));
  const inner = avatar
    ? `<img src="${avatar}" alt="">`
    : `<span>${initial}</span>`;
  const mobile = isMobileViewport();
  const size = mobile ? [50, 50] : [38, 38];
  const anchor = mobile ? [25, 25] : [19, 19];
  return L.divIcon({
    className: "",
    html: `<span class="world-map-token${selected ? " is-selected" : ""}" title="${name}">${inner}</span>`,
    iconSize: size,
    iconAnchor: anchor
  });
}

function LocationDetail({ location, dmMode, savingLocationId, onVisibilityChange, onSaveDescription }) {
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState(location.description || "");
  const visibility = location.visibility || "known";

  const saveDescription = async () => {
    if (!dmMode || !onSaveDescription) return;
    onSaveDescription(location.id, descriptionValue, setEditingDescription);
  };

  return (
    <article className="world-map-detail-card">
      <div className="eyebrow">{location.categoryLabel}</div>
      <h2>{location.name}</h2>
      {editingDescription ? (
        <div>
          <textarea
            value={descriptionValue}
            onChange={(e) => setDescriptionValue(e.target.value)}
            rows={3}
            className="world-map-description-edit"
          />
          <div className="world-map-edit-actions">
            <button className="btn primary" onClick={saveDescription} disabled={savingLocationId === location.id}>
              Сохранить
            </button>
            <button className="btn secondary" onClick={() => setEditingDescription(false)}>
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <p>{location.description}</p>
      )}
      {dmMode && !editingDescription && (
        <button className="btn secondary" onClick={() => setEditingDescription(true)}>
          Редактировать описание
        </button>
      )}
      <div className="world-map-detail-meta">
        <span className={`badge world-map-category-${location.category}`}>{WORLD_MAP_CATEGORY_LABELS[location.category]}</span>
        <span className={`badge world-map-visibility-${visibility}`}>{LOCATION_VISIBILITY_LABELS[visibility] || "Известна"}</span>
        <span className="badge secondary">x {Math.round(location.x)} / y {Math.round(location.y)}</span>
      </div>
      {dmMode ? (
        <div className="world-map-state-actions" aria-label="Видимость локации">
          {Object.entries(LOCATION_VISIBILITY_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`world-map-state-btn${visibility === key ? " active" : ""}`}
              disabled={savingLocationId === location.id}
              onClick={() => onVisibilityChange?.(location.id, key)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function PlayerDetail({ player }) {
  const profile = player?.publicProfile || {};
  const name = getPlayerName(player);
  const classPath = profile.classKey ? getClassPathLabel(profile) : "";
  const meta = [
    classPath || profile.classRole,
    profile.level ? `ур. ${profile.level}` : "",
    profile.reputation != null ? `реп. ${formatReputationLabel(profile.reputation)}` : "",
    profile.race
  ].filter(Boolean).join(" • ");

  return (
    <article className="world-map-detail-card">
      <div className="eyebrow">Жетон игрока</div>
      <h2>{name}</h2>
      <p>@{player?.displayName || `player-${player?.id ?? "?"}`}</p>
      {meta ? <p className="world-map-player-meta">{meta}</p> : null}
      <div className="world-map-detail-meta">
        <span className={`badge ${player?.status === "online" ? "ok" : "secondary"}`}>
          {player?.status === "online" ? "Онлайн" : "Офлайн"}
        </span>
      </div>
    </article>
  );
}

function MapDetailPanel({
  dmMode,
  error,
  onClear,
  onVisibilityChange,
  savingLocationId,
  selectedLocation,
  selectedPlayer,
  onSaveDescription
}) {
  const hasSelection = Boolean(selectedPlayer || selectedLocation);
  return (
    <>
      {error ? <div className="world-map-inline-error">{error}</div> : null}
      {hasSelection && onClear ? (
        <button className="world-map-detail-close" type="button" onClick={onClear} aria-label="Закрыть карточку">
          ×
        </button>
      ) : null}
      {selectedPlayer ? <PlayerDetail player={selectedPlayer} /> : null}
      {selectedLocation ? (
        <LocationDetail
          location={selectedLocation}
          dmMode={dmMode}
          savingLocationId={savingLocationId}
          onVisibilityChange={onVisibilityChange}
          onSaveDescription={onSaveDescription}
        />
      ) : null}
      {!selectedPlayer && !selectedLocation ? (
        <article className="world-map-detail-card">
          <div className="eyebrow">Выбор</div>
          <h2>Нажми на маркер</h2>
          <p>
            {dmMode
              ? "Выбери локацию или жетон игрока, чтобы открыть карточку. В DM-режиме маркеры можно перетаскивать прямо по карте."
              : "Выбери локацию или жетон игрока, чтобы открыть краткую карточку."}
          </p>
        </article>
      ) : null}
    </>
  );
}

export default function WorldMap({ mode = "player" }) {
  const dmMode = mode === "dm";
  const { socket } = useSocket();
  const mapPageRef = useRef(null);
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const imageLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const [locationStates, setLocationStates] = useState({});
  const [serverLocations, setServerLocations] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingLocationId, setSavingLocationId] = useState(null);
  const [savingPlayerId, setSavingPlayerId] = useState(null);
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState({ kind: "none", id: null });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapImageUrl, setMapImageUrl] = useState(null);

  // === ИСПРАВЛЕНИЕ ДЛЯ ПРОПОРЦИЙ: Храним реальные размеры карты ===
  const [mapDimensions, setMapDimensions] = useState({ width: WORLD_MAP_SIZE, height: WORLD_MAP_SIZE });
  const mapDimensionsRef = useRef(mapDimensions);

  // Вычисляем динамические границы на основе пропорций картинки
  const currentBounds = useMemo(() => [[0, 0], [mapDimensions.height, mapDimensions.width]], [mapDimensions]);
  const currentPaddedBounds = useMemo(() => [[-96, -96], [mapDimensions.height + 96, mapDimensions.width + 96]], [mapDimensions]);

  // Ссылка для отслеживания режима DM
  const dmModeRef = useRef(dmMode);
  useEffect(() => {
    dmModeRef.current = dmMode;
  }, [dmMode]);

  useEffect(() => {
    mapDimensionsRef.current = mapDimensions;
  }, [mapDimensions]);

  // Автоматический расчет пропорций файла при изменении ссылки на изображение
  useEffect(() => {
    if (!mapImageUrl) return;
    const img = new Image();
    img.onload = () => {
      const aspect = img.naturalWidth / img.naturalHeight;
      setMapDimensions({
        width: WORLD_MAP_SIZE * aspect, // Масштабируем ширину относительно базового размера
        height: WORLD_MAP_SIZE
      });
    };
    img.src = mapImageUrl;
  }, [mapImageUrl]);

  const loadPlayers = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const response = await api.worldMapState();
      
      setPlayers(Array.isArray(response?.players) ? response.players : []);
      setLocationStates(Object.fromEntries(
        (Array.isArray(response?.locationStates) ? response.locationStates : [])
          .filter((state) => state?.locationId)
          .map((state) => [state.locationId, state])
      ));
      setServerLocations(Array.isArray(response?.locations) ? response.locations : null);
      const nextDimensions = resolveWorldMapDimensions(response);
      if (nextDimensions) setMapDimensions(nextDimensions);
      setMapImageUrl(resolveWorldMapImageUrl(response));

    } catch (err) {
      setError(formatMapUiError(err));
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, setPlayers, setLocationStates, setServerLocations]);

  useEffect(() => {
    loadPlayers();
  }, [dmMode, loadPlayers]);

  useEffect(() => {
    if (!socket) return;
    const handleMapUpdate = () => loadPlayers();
    WORLD_MAP_SOCKET_EVENTS.forEach((eventName) => socket.on(eventName, handleMapUpdate));
    return () => {
      WORLD_MAP_SOCKET_EVENTS.forEach((eventName) => socket.off(eventName, handleMapUpdate));
    };
  }, [socket, loadPlayers]);

  const focusParty = useCallback(() => {
    const map = mapRef.current;
    if (!map || players.length === 0) return;
    const bounds = L.latLngBounds(
      players.map((player) => toMapLatLng(player.mapPosition?.x || 50, player.mapPosition?.y || 43, mapDimensions))
    );
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [players, mapDimensions]);

  const clearSelection = useCallback(() => setSelected({ kind: "none", id: null }), []);

  const saveLocationVisibility = useCallback(async (locationId, visibility) => {
    if (!dmMode) return;
    setSavingLocationId(locationId);
    setError("");
    setLocationStates((current) => ({
      ...current,
      [locationId]: { ...current[locationId], locationId, visibility }
    }));
    try {
      await api.dmUpdateLocationState(locationId, { visibility });
    } catch (err) {
      setError(formatMapUiError(err, "Не удалось обновить локацию"));
      loadPlayers().catch(() => {});
    } finally {
      setSavingLocationId(null);
    }
  }, [dmMode, setError, setSavingLocationId, setLocationStates, loadPlayers]);

  const savePlayerPosition = useCallback(async (playerId, position) => {
    if (!dmMode) return;
    setSavingPlayerId(playerId);
    setError("");
    try {
      await api.dmUpdateMapPosition(playerId, position);
    } catch (err) {
      setError(formatMapUiError(err, "Не удалось обновить позицию"));
    } finally {
      setSavingPlayerId(null);
    }
  }, [dmMode, setError, setSavingPlayerId]);

  const handleFullscreenToggle = useCallback(() => {
    const el = mapPageRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => mapRef.current?.invalidateSize(), 100);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const effectiveLocations = useMemo(() => {
    const base = Array.isArray(serverLocations) ? serverLocations : WORLD_MAP_LOCATIONS;
    return base.map((location) => {
      const id = location.id;
      const state = locationStates[id] || {};
      return {
        ...location,
        visibility: state.visibility || location.visibility || location.defaultVisibility || "known",
        x: coerceMapCoordinate(state.x, location.x ?? location.defaultX ?? location.default_x ?? 50),
        y: coerceMapCoordinate(state.y, location.y ?? location.defaultY ?? location.default_y ?? 43)
      };
    });
  }, [serverLocations, locationStates]);

  const visibleLocations = useMemo(() => {
    const filtered = category === "all" ? effectiveLocations : effectiveLocations.filter((location) => location.category === category);
    return dmMode ? filtered : filtered.filter((location) => location.visibility !== "hidden");
  }, [category, dmMode, effectiveLocations]);

  const selectedLocation = selected.kind === "location" ? effectiveLocations.find((location) => location.id === selected.id) : null;
  const selectedPlayer = selected.kind === "player" ? players.find((player) => player.id === selected.id) : null;

  // Инициализация холста карты Leaflet
  useEffect(() => {
    const mapEl = mapElRef.current;
    if (!mapEl) return;
    if (mapRef.current) return;

    const map = L.map(mapEl, { crs: L.CRS.Simple, maxZoom: 2, minZoom: -1.25, zoomSnap: 0.25, zoomDelta: 0.25, wheelPxPerZoomLevel: 60 });
    mapRef.current = map;
    
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    
    map.setMaxBounds(MAP_PADDED_BOUNDS);
    map.setView([WORLD_MAP_SIZE / 2, WORLD_MAP_SIZE / 2], -1);
    
    const applyPlayerMobileView = () => {
      window.requestAnimationFrame(() => {
        if (!mapRef.current) return;
        map.invalidateSize();
        
        if (!isMobileViewport() || dmModeRef.current) {
          map.setMinZoom(-1.25);
          return;
        }

        const dims = mapDimensionsRef.current;
        const coverZoom = Math.max(-1.25, getCoverZoom(map, dims));
        map.setMinZoom(coverZoom);
        if (map.getZoom() < coverZoom) {
          map.setView([dims.height / 2, dims.width / 2], coverZoom, { animate: false });
        }
      });
    };
    
    applyPlayerMobileView();
    window.addEventListener("resize", applyPlayerMobileView);
    window.addEventListener("orientationchange", applyPlayerMobileView);
    
    return () => { 
      window.removeEventListener("resize", applyPlayerMobileView); 
      window.removeEventListener("orientationchange", applyPlayerMobileView); 
      if (mapRef.current) {
         mapRef.current.remove();
         mapRef.current = null;
      }
    };
  }, []);

  // Управление слоем изображения подложки и его динамическими границами
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapImageUrl) return;

    if (imageLayerRef.current) {
      imageLayerRef.current.remove();
    }

    const newImageLayer = L.imageOverlay(mapImageUrl, currentBounds, { 
      interactive: false, 
      crossOrigin: false 
    }).addTo(map);
    
    newImageLayer.bringToBack();
    imageLayerRef.current = newImageLayer;

    // Переопределяем границы перемещения камеры под новую форму изображения
    map.setMaxBounds(currentPaddedBounds);
    map.invalidateSize();

    return () => {
      if (imageLayerRef.current) {
        imageLayerRef.current.remove();
        imageLayerRef.current = null;
      }
    };
  }, [mapImageUrl, currentBounds, currentPaddedBounds]);

  const saveLocationPosition = useCallback(async (location, position) => {
    if (!dmMode) return;
    setSavingLocationId(location.id);
    setError("");
    setLocationStates((current) => ({
      ...current,
      [location.id]: { ...current[location.id], locationId: location.id, ...position }
    }));
    try {
      await api.dmUpdateLocationPosition(location.id, position);
    } catch (err) {
      setError(formatMapUiError(err, "Не удалось обновить позицию локации"));
      loadPlayers().catch(() => {});
    } finally {
      setSavingLocationId(null);
    }
  }, [dmMode, setError, setSavingLocationId, setLocationStates, loadPlayers]);

  // Рендеринг токенов игроков и маркеров с обновленной математикой
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    visibleLocations.forEach((location) => {
      const marker = L.marker(toMapLatLng(location.x, location.y, mapDimensions), {
        icon: makeLocationIcon(location, selected.kind === "location" && selected.id === location.id),
        keyboard: true,
        title: location.name,
        draggable: dmMode
      });
      marker.on("click", () => setSelected({ kind: "location", id: location.id }));
      if (dmMode) {
        marker.on("dragend", () => {
          const latLng = marker.getLatLng();
          // Рассчитываем процент относительно динамической ширины и высоты
          const x = Math.min(100, Math.max(0, (latLng.lng / mapDimensions.width) * 100));
          const y = Math.min(100, Math.max(0, ((mapDimensions.height - latLng.lat) / mapDimensions.height) * 100));
          saveLocationPosition(location, { x, y });
        });
      }
      marker.addTo(layer);
    });

    players.forEach((player) => {
      const position = player.mapPosition || { x: 50, y: 43 };
      const marker = L.marker(toMapLatLng(position.x, position.y, mapDimensions), {
        icon: makePlayerIcon(player, selected.kind === "player" && selected.id === player.id),
        keyboard: true,
        title: getPlayerName(player),
        draggable: dmMode,
        zIndexOffset: 500
      });
      marker.on("click", () => setSelected({ kind: "player", id: player.id }));
      if (dmMode) {
        marker.on("dragend", () => {
          const latLng = marker.getLatLng();
          // Рассчитываем процент относительно динамической ширины и высоты
          const x = Math.min(100, Math.max(0, (latLng.lng / mapDimensions.width) * 100));
          const y = Math.min(100, Math.max(0, ((mapDimensions.height - latLng.lat) / mapDimensions.height) * 100));
          savePlayerPosition(player.id, { x, y });
        });
      }
      marker.addTo(layer);
    });
  }, [selected, visibleLocations, players, dmMode, mapDimensions, saveLocationPosition, savePlayerPosition]);

  return (
    <div ref={mapPageRef} className={`world-map-page ${dmMode ? "is-dm" : "is-player"}`}>
      <section className="card world-map-hero">
        <div className="world-map-hero-copy">
          <div className="eyebrow">{dmMode ? "DM Control" : "Adventure Atlas"}</div>
          <h1>Карта мира</h1>
          <p>
            {dmMode
              ? "Двигай жетоны, открывай локации и держи всю навигацию партии в одном экране."
              : "Следи за маршрутом группы, открывай точки интереса и смотри текущее положение игроков."}
          </p>
        </div>
        <div className="world-map-hero-actions">
          <button className="btn secondary" type="button" onClick={focusParty} disabled={players.length === 0}>
            <Crosshair className="icon" aria-hidden="true" />
            Партия
          </button>
          <button className="btn secondary" type="button" onClick={loadPlayers} disabled={loading}>
            <RefreshCcw className="icon" aria-hidden="true" />
            Обновить
          </button>
          {!dmMode ? (
            <button className="btn secondary" type="button" onClick={handleFullscreenToggle}>
              {isFullscreen
                ? <Minimize className="icon" aria-hidden="true" />
                : <Fullscreen className="icon" aria-hidden="true" />}
              {isFullscreen ? "Выйти" : "На весь экран"}
            </button>
          ) : null}
          {dmMode ? (
            <button className="btn secondary" type="button" onClick={() => setCategory("all")}>
              Все категории
            </button>
          ) : null}
        </div>
      </section>
      <section className="world-map-layout">
        <div className="tf-panel world-map-board">
          <div className="world-map-toolbar">
            <div className="world-map-tabs" role="list" aria-label="Фильтр локаций">
              {Object.entries(WORLD_MAP_CATEGORY_LABELS).map(([key, label]) => (
                <button key={key} type="button" className={`world-map-tab${category === key ? " active" : ""}`} onClick={() => setCategory(key)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="world-map-toolbar-side">
              <div className="world-map-counter">
                <span>{visibleLocations.length} мест</span>
                <span>{players.length} игроков</span>
                {dmMode ? <span>{savingLocationId ? "Сохраняю метку" : savingPlayerId ? `Сохраняю #${savingPlayerId}` : "DM-режим"}</span> : null}
              </div>
              {dmMode ? (
                <div className="world-map-toolbar-note">
                  Перетаскивай маркеры и жетоны прямо на карте.
                </div>
              ) : null}
            </div>
          </div>
          <div className="world-map-stage">
            <div className="world-map-map-actions" aria-label="Действия карты">
              <button className="btn secondary" type="button" onClick={focusParty} disabled={players.length === 0}>
                <Crosshair className="icon" aria-hidden="true" />
                Партия
              </button>
              <button className="btn secondary" type="button" onClick={loadPlayers} disabled={loading}>
                <RefreshCcw className="icon" aria-hidden="true" />
                Обновить
              </button>
              {!dmMode ? (
                <button className="btn secondary" type="button" onClick={handleFullscreenToggle}>
                  {isFullscreen ? <Minimize className="icon" aria-hidden="true" /> : <Fullscreen className="icon" aria-hidden="true" />}
                  {isFullscreen ? "Выйти" : "На весь экран"}
                </button>
              ) : null}
            </div>
            <div ref={mapElRef} className="world-map-canvas" aria-label="Интерактивная карта мира" />
            {loading && (
              <div className="world-map-loading-overlay">
                <div className="world-map-loading-spinner">Загрузка карты...</div>
              </div>
            )}
          </div>
          <div className="world-map-mobile-actions" aria-label="Действия карты">
            <button className="btn secondary" type="button" onClick={focusParty} disabled={players.length === 0}>
              <Crosshair className="icon" aria-hidden="true" />
              <span>Партия</span>
            </button>
            <button className="btn secondary" type="button" onClick={loadPlayers} disabled={loading}>
              <RefreshCcw className="icon" aria-hidden="true" />
              <span>Обновить</span>
            </button>
            {!dmMode ? (
              <button className="btn secondary" type="button" onClick={handleFullscreenToggle}>
                {isFullscreen
                  ? <Minimize className="icon" aria-hidden="true" />
                  : <Fullscreen className="icon" aria-hidden="true" />}
                <span>{isFullscreen ? "Выйти" : "На весь экран"}</span>
              </button>
            ) : null}
          </div>
          {error || selectedPlayer || selectedLocation ? (
            <div className="world-map-mobile-sheet" aria-live="polite">
              <MapDetailPanel dmMode={dmMode} error={error} onClear={clearSelection} onVisibilityChange={saveLocationVisibility}
                savingLocationId={savingLocationId} selectedLocation={selectedLocation} selectedPlayer={selectedPlayer}
                onSaveDescription={async (locationId, description, done) => {
                  setSavingLocationId(locationId);
                  setError("");
                  try {
                    await api.dmUpdateLocation(locationId, { description });
                    setServerLocations((current) => current?.map((loc) => loc.id === locationId ? { ...loc, description } : loc));
                    done(false);
                  } catch (err) {
                    setError(formatMapUiError(err, "Не удалось обновить описание"));
                  } finally {
                    setSavingLocationId(null);
                  }
                }} />
            </div>
          ) : null}
        </div>
        <aside className="world-map-sidebar">
          <MapDetailPanel dmMode={dmMode} error={error} onClear={clearSelection} onVisibilityChange={saveLocationVisibility}
            savingLocationId={savingLocationId} selectedLocation={selectedLocation} selectedPlayer={selectedPlayer}
            onSaveDescription={async (locationId, description, done) => {
              setSavingLocationId(locationId);
              setError("");
              try {
                await api.dmUpdateLocation(locationId, { description });
                setServerLocations((current) => current?.map((loc) => loc.id === locationId ? { ...loc, description } : loc));
                done(false);
              } catch (err) {
                setError(formatMapUiError(err, "Не удалось обновить описание"));
              } finally {
                setSavingLocationId(null);
              }
            }} />
          {dmMode ? (
            <Suspense fallback={null}>
              <DMMapEditor embedded onChanged={loadPlayers} />
            </Suspense>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
