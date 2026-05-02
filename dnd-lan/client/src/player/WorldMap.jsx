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
  return L.divIcon({
    className: "",
    html: `<span class="world-map-marker world-map-marker-${location.category} world-map-marker-${location.visibility || "known"}${selected ? " is-selected" : ""}" aria-hidden="true"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

function makePlayerIcon(player, selected) {
  const name = escapeMarkerHtml(getPlayerName(player));
  const avatar = escapeMarkerHtml(player?.publicProfile?.avatarUrl);
  const initial = escapeMarkerHtml(getPlayerInitial(player));
  const inner = avatar
    ? `<img src="${avatar}" alt="">`
    : `<span>${initial}</span>`;
  return L.divIcon({
    className: "",
    html: `<span class="world-map-token${selected ? " is-selected" : ""}" title="${name}">${inner}</span>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19]
  });
}

function LocationDetail({ location, dmMode, savingLocationId, onVisibilityChange }) {
  const visibility = location.visibility || "known";
  return (
    <article className="world-map-detail-card">
      <div className="eyebrow">{location.categoryLabel}</div>
      <h2>{location.name}</h2>
      <p>{location.description}</p>
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
          {player?.status === "online" ? "В сети" : player?.status || "Неактивен"}
        </span>
        <span className="badge secondary">#{player?.id}</span>
      </div>
    </article>
  );
}

function TokenDetail({ token }) {
  if (!token) return null;
  return (
    <article className="world-map-detail-card">
      <div className="eyebrow">Жетон</div>
      <h2>{token.name || `Жетон #${token.id}`}</h2>
      <p>Тип: {token.type || "-"}</p>
      <div className="world-map-detail-meta">
        <span className="badge secondary">#{token.id}</span>
        <span className="badge">x {Math.round(token.x ?? 50)} / y {Math.round(token.y ?? 43)}</span>
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
  selectedToken
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
      {selectedToken ? <TokenDetail token={selectedToken} /> : null}
      {selectedLocation ? (
        <LocationDetail
          location={selectedLocation}
          dmMode={dmMode}
          savingLocationId={savingLocationId}
          onVisibilityChange={onVisibilityChange}
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
  const [tokens, setTokens] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingLocationId, setSavingLocationId] = useState(null);
  const [savingPlayerId, setSavingPlayerId] = useState(null);
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState({ kind: "none", id: null });

  const locations = useMemo(() => WORLD_MAP_LOCATIONS.map((location) => ({
    ...location,
    visibility: locationStates[location.id]?.visibility || location.defaultVisibility || "known",
    x: coerceMapCoordinate(locationStates[location.id]?.x, location.x),
    y: coerceMapCoordinate(locationStates[location.id]?.y, location.y)
  })), [locationStates]);

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
    const filtered = category === "all"
      ? effectiveLocations
      : effectiveLocations.filter((location) => location.category === category);
    return dmMode ? filtered : filtered.filter((location) => location.visibility !== "hidden");
  }, [category, dmMode, effectiveLocations]);

  const selectedLocation = selected.kind === "location"
    ? effectiveLocations.find((location) => location.id === selected.id)
    : null;
  const selectedPlayer = selected.kind === "player"
    ? players.find((player) => player.id === selected.id)
    : null;
  const selectedToken = selected.kind === "token"
    ? tokens.find((t) => Number(t.id) === Number(selected.id))
    : null;

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
      setTokens(Array.isArray(response?.tokens) ? response.tokens : []);
    } catch (err) {
      setError(String(err?.message || "Не удалось загрузить игроков"));
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlayers().catch(() => {});
  }, [loadPlayers]);

  useEffect(() => {
    if (!socket) return () => {};
    const onPositionUpdated = (payload) => {
      const playerId = Number(payload?.playerId || 0);
      const position = payload?.position;
      if (!playerId || !position) return;
      setPlayers((current) => current.map((player) => (
        Number(player.id) === playerId
          ? { ...player, mapPosition: { ...player.mapPosition, ...position } }
          : player
      )));
    };
    const onPlayersUpdated = () => {
      loadPlayers().catch(() => {});
    };
    const onLocationUpdated = (payload) => {
      const locationId = String(payload?.locationId || "");
      const state = payload?.state;
      if (!locationId || !state) return;
      setLocationStates((current) => ({
        ...current,
        [locationId]: { ...current[locationId], ...state, locationId }
      }));
      if (!dmMode && state.visibility === "hidden") {
        setSelected((current) => (current.kind === "location" && current.id === locationId
          ? { kind: "none", id: null }
          : current));
      }
    };
    const onLocationCreated = (payload) => {
      const loc = payload?.location;
      if (!loc) return;
      setServerLocations((cur) => {
        const next = Array.isArray(cur) ? [...cur] : [];
        if (!next.find((l) => l.id === loc.id)) next.push(loc);
        return next;
      });
    };
    const onLocationDeleted = (payload) => {
      const locationId = String(payload?.locationId || "");
      if (!locationId) return;
      setServerLocations((cur) => (Array.isArray(cur) ? cur.filter((l) => l.id !== locationId) : cur));
      setLocationStates((cur) => {
        const copy = { ...cur };
        delete copy[locationId];
        return copy;
      });
      setSelected((cur) => (cur.kind === "location" && cur.id === locationId ? { kind: "none", id: null } : cur));
    };
    const onTokenCreated = (payload) => {
      const token = payload?.token;
      if (!token) return;
      setTokens((cur) => (Array.isArray(cur) ? [...cur, token] : [token]));
    };
    const onTokenUpdated = (payload) => {
      const token = payload?.token;
      if (!token) return;
      setTokens((cur) => (Array.isArray(cur) ? cur.map((t) => (Number(t.id) === Number(token.id) ? token : t)) : [token]));
    };
    const onTokenDeleted = (payload) => {
      const tokenId = Number(payload?.tokenId || 0);
      if (!tokenId) return;
      setTokens((cur) => (Array.isArray(cur) ? cur.filter((t) => Number(t.id) !== tokenId) : cur));
      setSelected((cur) => (cur.kind === "token" && Number(cur.id) === tokenId ? { kind: "none", id: null } : cur));
    };
    socket.on("map:positionUpdated", onPositionUpdated);
    socket.on("map:locationUpdated", onLocationUpdated);
    socket.on("map:locationCreated", onLocationCreated);
    socket.on("map:locationDeleted", onLocationDeleted);
    socket.on("map:tokenCreated", onTokenCreated);
    socket.on("map:tokenUpdated", onTokenUpdated);
    socket.on("map:tokenDeleted", onTokenDeleted);
    socket.on("players:updated", onPlayersUpdated);
    return () => {
      socket.off("map:positionUpdated", onPositionUpdated);
      socket.off("map:locationUpdated", onLocationUpdated);
      socket.off("map:locationCreated", onLocationCreated);
      socket.off("map:locationDeleted", onLocationDeleted);
      socket.off("map:tokenCreated", onTokenCreated);
      socket.off("map:tokenUpdated", onTokenUpdated);
      socket.off("map:tokenDeleted", onTokenDeleted);
      socket.off("players:updated", onPlayersUpdated);
    };
  }, [dmMode, loadPlayers, socket]);

  const savePlayerPosition = useCallback(async (playerId, position) => {
    if (!dmMode) return;
    setSavingPlayerId(playerId);
    setError("");
    setPlayers((current) => current.map((player) => (
      Number(player.id) === Number(playerId)
        ? { ...player, mapPosition: { ...player.mapPosition, ...position, saved: true } }
        : player
    )));
    try {
      await api.dmUpdateMapPosition(playerId, position);
    } catch (err) {
      setError(String(err?.message || "Не удалось сохранить позицию"));
      loadPlayers().catch(() => {});
    } finally {
      setSavingPlayerId(null);
    }
  }, [dmMode, loadPlayers]);

  const saveTokenPosition = useCallback(async (tokenId, position) => {
    if (!dmMode) return;
    setError("");
    setTokens((cur) => (Array.isArray(cur) ? cur.map((t) => (Number(t.id) === Number(tokenId) ? { ...t, x: position.x, y: position.y } : t)) : cur));
    try {
      await api.dmUpdateToken(tokenId, { x: position.x, y: position.y });
    } catch (err) {
      setError(String(err?.message || "Не удалось сохранить жетон"));
      loadPlayers().catch(() => {});
    }
  }, [dmMode, loadPlayers]);

  const saveLocationVisibility = useCallback(async (locationId, visibility) => {
    if (!dmMode) return;
    setSavingLocationId(locationId);
    setError("");
    setLocationStates((current) => ({
      ...current,
      [locationId]: {
        ...current[locationId],
        locationId,
        visibility
      }
    }));
    try {
      await api.dmUpdateLocationState(locationId, { visibility });
    } catch (err) {
      setError(String(err?.message || "Не удалось обновить локацию"));
      loadPlayers().catch(() => {});
    } finally {
      setSavingLocationId(null);
    }
  }, [dmMode, loadPlayers]);

  const saveLocationPosition = useCallback(async (location, position) => {
    if (!dmMode) return;
    setSavingLocationId(location.id);
    setError("");
    setLocationStates((current) => ({
      ...current,
      [location.id]: {
        ...current[location.id],
        locationId: location.id,
        visibility: location.visibility,
        ...position
      }
    }));
    try {
      await api.dmUpdateLocationPosition(location.id, {
        ...position,
        visibility: location.visibility
      });
    } catch (err) {
      setError(String(err?.message || "Не удалось сохранить метку"));
      loadPlayers().catch(() => {});
    } finally {
      setSavingLocationId(null);
    }
  }, [dmMode, loadPlayers]);

  const focusParty = useCallback(() => {
    const map = mapRef.current;
    if (!map || players.length === 0) return;
    const points = players.map((player) => {
      const position = player.mapPosition || { x: 50, y: 43 };
      return toMapLatLng(position.x, position.y);
    });
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 0.25), { animate: true });
      return;
    }
    map.fitBounds(L.latLngBounds(points), {
      animate: true,
      maxZoom: 0.65,
      padding: [64, 64]
    });
  }, [players]);

  const clearSelection = useCallback(() => {
    setSelected({ kind: "none", id: null });
  }, []);

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return undefined;

    const map = L.map(mapElRef.current, {
      crs: L.CRS.Simple,
      minZoom: -1.25,
      maxZoom: 2.5,
      zoomControl: false,
      attributionControl: false,
      maxBounds: MAP_PADDED_BOUNDS,
      maxBoundsViscosity: 0.85
    });

    imageLayerRef.current = L.imageOverlay(MAP_IMAGE_URL, MAP_BOUNDS).addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.fitBounds(MAP_BOUNDS, { padding: [16, 16] });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      imageLayerRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return () => {};

    const applyPlayerMobileView = () => {
      window.requestAnimationFrame(() => {
        map.invalidateSize();
        if (!isMobileViewport() || dmMode) {
          map.setMinZoom(-1.25);
          map.setMaxBounds(MAP_PADDED_BOUNDS);
          if (!map.getBounds().isValid()) {
            map.fitBounds(MAP_BOUNDS, { padding: [16, 16] });
          }
          return;
        }
        const coverZoom = Math.max(-1.25, getCoverZoom(map));
        map.setMinZoom(coverZoom);
        map.setMaxBounds(MAP_BOUNDS);
        if (map.getZoom() < coverZoom) {
          map.setView(MAP_CENTER, coverZoom, { animate: false });
        }
      });
    };

    applyPlayerMobileView();
    window.addEventListener("resize", applyPlayerMobileView);
    window.addEventListener("orientationchange", applyPlayerMobileView);
    return () => {
      window.removeEventListener("resize", applyPlayerMobileView);
      window.removeEventListener("orientationchange", applyPlayerMobileView);
    };
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

    // render tokens
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
  }, [dmMode, players, saveLocationPosition, savePlayerPosition, saveTokenPosition, selected, visibleLocations, tokens]);

  return (
    <div className={`world-map-page ${dmMode ? "is-dm" : "is-player"}`}>
      <section className="tf-panel world-map-hero">
        <div>
          <div className="eyebrow">{dmMode ? "DM map control" : "Campaign map"}</div>
          <h1>{dmMode ? "Карта партии" : "Карта мира"}</h1>
          <p>{dmMode ? "Перетаскивай жетоны игроков, чтобы обновить их положение у всей партии." : "Локации мира и жетоны партии на одном листе."}</p>
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
        </div>
      </section>

      <section className="world-map-layout">
        <div className="tf-panel world-map-board">
          <div className="world-map-toolbar">
            <div className="world-map-tabs" role="list" aria-label="Фильтр локаций">
              {Object.entries(WORLD_MAP_CATEGORY_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`world-map-tab${category === key ? " active" : ""}`}
                  onClick={() => setCategory(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="world-map-counter">
              <span>{visibleLocations.length} мест</span>
              <span>{players.length} игроков</span>
              {dmMode ? <span>{savingLocationId ? "Сохраняю метку" : savingPlayerId ? `Сохраняю #${savingPlayerId}` : "DM-режим"}</span> : null}
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
            </div>
            <div ref={mapElRef} className="world-map-canvas" aria-label="Интерактивная карта мира" />
          </div>
          {error || selectedPlayer || selectedLocation ? (
            <div className="world-map-mobile-sheet" aria-live="polite">
              <MapDetailPanel
                dmMode={dmMode}
                error={error}
                onClear={clearSelection}
                onVisibilityChange={saveLocationVisibility}
                savingLocationId={savingLocationId}
                selectedLocation={selectedLocation}
                selectedPlayer={selectedPlayer}
              />
            </div>
          ) : null}
        </div>

        <aside className="world-map-sidebar">
          <MapDetailPanel
            dmMode={dmMode}
            error={error}
            onClear={clearSelection}
            onVisibilityChange={saveLocationVisibility}
            savingLocationId={savingLocationId}
            selectedLocation={selectedLocation}
            selectedPlayer={selectedPlayer}
          />
        </aside>
      </section>
    </div>
  );
}
