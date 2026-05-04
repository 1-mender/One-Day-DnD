import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, RefreshCcw } from "lucide-react";
import { api } from "../api.js";
import { useSocket } from "../context/SocketContext.jsx";
import { getClassPathLabel } from "./classCatalog.js";
import { formatReputationLabel } from "./profileDomain.js";
import {
  WORLD_MAP_CATEGORY_LABELS,
  WORLD_MAP_LOCATIONS,
  WORLD_MAP_SIZE
} from "./worldMapLocations.js";

const MAP_IMAGE_URL = "/map/where-is-the-lord.png";
const MAP_BOUNDS = [[0, 0], [WORLD_MAP_SIZE, WORLD_MAP_SIZE]];
const MAP_PADDED_BOUNDS = [[-96, -96], [WORLD_MAP_SIZE + 96, WORLD_MAP_SIZE + 96]];
const MAP_CENTER = [WORLD_MAP_SIZE / 2, WORLD_MAP_SIZE / 2];
const LOCATION_VISIBILITY_LABELS = {
  hidden: "Скрыта",
  known: "Известна",
  active: "Активна",
  completed: "Пройдена"
};

function coerceMapCoordinate(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toMapLatLng(x, y) {
  return [WORLD_MAP_SIZE - (y / 100) * WORLD_MAP_SIZE, (x / 100) * WORLD_MAP_SIZE];
}

function getCoverZoom(map) {
  const size = map.getSize();
  if (!size.x || !size.y) return 0;
  return Math.max(
    Math.log2(size.x / WORLD_MAP_SIZE),
    Math.log2(size.y / WORLD_MAP_SIZE)
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
      {error ? <div className="badge off">{error}</div> : null}
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
          <p>Выбери локацию или жетон игрока, чтобы открыть краткую карточку.</p>
        </article>
      ) : null}
    </>
  );
}

export default function WorldMap({ mode = "player" }) {
  const dmMode = mode === "dm";
  const { socket } = useSocket();
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
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [availableMaps, setAvailableMaps] = useState([]);

  useEffect(() => {
    loadPlayers();
    if (dmMode) {
      api.dmListMaps().then(setAvailableMaps).catch(() => {});
    }
  }, [dmMode, loadPlayers]);

  useEffect(() => {
    if (!socket) return;
    const handleMapUpdate = () => loadPlayers();
    socket.on('map:state', handleMapUpdate);
    return () => socket.off('map:state', handleMapUpdate);
  }, [socket, loadPlayers]);

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
    } catch (err) {
      setError(String(err?.message || "Не удалось загрузить карту"));
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, setPlayers, setLocationStates, setServerLocations]);

  const focusParty = useCallback(() => {
    const map = mapRef.current;
    if (!map || players.length === 0) return;
    const bounds = L.latLngBounds(
      players.map((player) => toMapLatLng(player.mapPosition?.x || 50, player.mapPosition?.y || 43))
    );
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [players]);

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
      setError(String(err?.message || "Не удалось обновить локацию"));
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
      setError(String(err?.message || "Не удалось обновить позицию"));
    } finally {
      setSavingPlayerId(null);
    }
  }, [dmMode, setError, setSavingPlayerId]);

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

  useEffect(() => {
    const mapEl = mapElRef.current;
    if (!mapEl) return;
    const map = L.map(mapEl, { crs: L.CRS.Simple, maxZoom: 2, minZoom: -1.25, zoomSnap: 0.25, zoomDelta: 0.25, wheelPxPerZoomLevel: 60 });
    mapRef.current = map;
    const imageLayer = L.imageOverlay(MAP_IMAGE_URL, MAP_BOUNDS, { interactive: false, crossOrigin: false }).addTo(map);
    imageLayerRef.current = imageLayer;
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    map.setMaxBounds(MAP_PADDED_BOUNDS);
    map.setView(MAP_CENTER, -1);
    const applyPlayerMobileView = () => {
      window.requestAnimationFrame(() => {
        map.invalidateSize();
        if (!isMobileViewport() || dmMode) {
          map.setMinZoom(-1.25);
          map.setMaxBounds(MAP_PADDED_BOUNDS);
          if (!map.getBounds().isValid()) map.fitBounds(MAP_BOUNDS, { padding: [16, 16] });
          return;
        }
        const coverZoom = Math.max(-1.25, getCoverZoom(map));
        map.setMinZoom(coverZoom);
        map.setMaxBounds(MAP_BOUNDS);
        if (map.getZoom() < coverZoom) map.setView(MAP_CENTER, coverZoom, { animate: false });
      });
    };
    applyPlayerMobileView();
    window.addEventListener("resize", applyPlayerMobileView);
    window.addEventListener("orientationchange", applyPlayerMobileView);
    return () => { window.removeEventListener("resize", applyPlayerMobileView); window.removeEventListener("orientationchange", applyPlayerMobileView); };
  }, [dmMode]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    visibleLocations.forEach((location) => {
      const marker = L.marker(toMapLatLng(location.x, location.y), {
        icon: makeLocationIcon(location, selected.kind === "location" && selected.id === location.id),
        keyboard: true,
        title: location.name,
        draggable: dmMode
      });
      marker.on("click", () => setSelected({ kind: "location", id: location.id }));
      if (dmMode) {
        marker.on("dragend", () => {
          const latLng = marker.getLatLng();
          const x = Math.min(100, Math.max(0, (latLng.lng / WORLD_MAP_SIZE) * 100));
          const y = Math.min(100, Math.max(0, ((WORLD_MAP_SIZE - latLng.lat) / WORLD_MAP_SIZE) * 100));
          saveLocationPosition(location, { x, y });
        });
      }
      marker.addTo(layer);
    });
    players.forEach((player) => {
      const position = player.mapPosition || { x: 50, y: 43 };
      const marker = L.marker(toMapLatLng(position.x, position.y), {
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
          const x = Math.min(100, Math.max(0, (latLng.lng / WORLD_MAP_SIZE) * 100));
          const y = Math.min(100, Math.max(0, ((WORLD_MAP_SIZE - latLng.lat) / WORLD_MAP_SIZE) * 100));
          savePlayerPosition(player.id, { x, y });
        });
      }
      marker.addTo(layer);
    });
  }, [selected, visibleLocations, players, dmMode, saveLocationPosition, savePlayerPosition]);

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
      setError(String(err?.message || "Не удалось обновить позицию локации"));
      loadPlayers().catch(() => {});
    } finally {
      setSavingLocationId(null);
    }
  }, [dmMode, setError, setSavingLocationId, setLocationStates, loadPlayers]);

  return (
    <div className="world-map-page">
      <section className="tf-page-header">
        <h1>Карта мира</h1>
        <div className="tf-header-actions">
          <button className="btn secondary" type="button" onClick={focusParty} disabled={players.length === 0}>
            <Crosshair className="icon" aria-hidden="true" />
            Партия
          </button>
          <button className="btn secondary" type="button" onClick={loadPlayers} disabled={loading}>
            <RefreshCcw className="icon" aria-hidden="true" />
            Обновить
          </button>
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
            <div className="world-map-counter">
              <span>{visibleLocations.length} мест</span>
              <span>{players.length} игроков</span>
              {dmMode ? <span>{savingLocationId ? "Сохраняю метку" : savingPlayerId ? `Сохраняю #${savingPlayerId}` : "DM-режим"}</span> : null}
            </div>
            {dmMode && (
              <div className="world-map-dm-controls">
                <button className="btn secondary" type="button" onClick={focusParty} disabled={players.length === 0}>Центрировать на партии</button>
                <button className="btn secondary" type="button" onClick={() => setCategory("all")}>Показать все категории</button>
                <button className="btn secondary" type="button" onClick={() => setShowMapSelector(true)}>Сменить карту</button>
              </div>
            )}
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
            </div>
            <div ref={mapElRef} className="world-map-canvas" aria-label="Интерактивная карта мира" />
            {loading && (
              <div className="world-map-loading-overlay">
                <div className="world-map-loading-spinner">Загрузка карты...</div>
              </div>
            )}
          </div>
          {showMapSelector && (
            <div className="world-map-map-selector">
              <h3>Выбрать карту</h3>
              {availableMaps.map((map) => (
                <button key={map.id} className="btn secondary" onClick={() => {
                  api.dmActivateMap(map.id).then(() => { setShowMapSelector(false); loadPlayers(); }).catch(setError);
                }}>{map.name}</button>
              ))}
              <input type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files[0];
                if (file) api.dmUploadMap(file, file.name).then(() => api.dmListMaps().then(setAvailableMaps)).catch(setError);
              }} style={{ display: 'block', marginTop: '10px' }} />
              <button className="btn secondary" onClick={() => setShowMapSelector(false)}>Закрыть</button>
            </div>
          )}
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
                    setError(String(err?.message || "Не удалось обновить описание"));
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
                setError(String(err?.message || "Не удалось обновить описание"));
              } finally {
                setSavingLocationId(null);
              }
            }} />
        </aside>
      </section>
    </div>
  );
}
