import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { RefreshCcw } from "lucide-react";
import { api } from "../api.js";
import {
  WORLD_MAP_CATEGORY_LABELS,
  WORLD_MAP_LOCATIONS,
  WORLD_MAP_SIZE
} from "./worldMapLocations.js";

const MAP_IMAGE_URL = "/map/where-is-the-lord.png";
const MAP_BOUNDS = [[0, 0], [WORLD_MAP_SIZE, WORLD_MAP_SIZE]];
const DEFAULT_PARTY_POSITION = { x: 50, y: 43 };

function toMapLatLng(x, y) {
  return [WORLD_MAP_SIZE - (y / 100) * WORLD_MAP_SIZE, (x / 100) * WORLD_MAP_SIZE];
}

function getPlayerTokenPosition(index, count) {
  const radius = count <= 1 ? 0 : Math.min(7, 3 + count);
  const angle = (Math.PI * 2 * index) / Math.max(1, count);
  return {
    x: DEFAULT_PARTY_POSITION.x + Math.cos(angle) * radius,
    y: DEFAULT_PARTY_POSITION.y + Math.sin(angle) * radius
  };
}

function getPlayerName(player) {
  return player?.publicProfile?.characterName || player?.displayName || `Игрок #${player?.id ?? "?"}`;
}

function getPlayerInitial(player) {
  return String(getPlayerName(player)).trim().slice(0, 1).toUpperCase() || "?";
}

function makeLocationIcon(location, selected) {
  return L.divIcon({
    className: "",
    html: `<span class="world-map-marker world-map-marker-${location.category}${selected ? " is-selected" : ""}" aria-hidden="true"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

function makePlayerIcon(player, selected) {
  const name = getPlayerName(player);
  const avatar = player?.publicProfile?.avatarUrl;
  const initial = getPlayerInitial(player);
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

function LocationDetail({ location }) {
  return (
    <article className="world-map-detail-card">
      <div className="eyebrow">{location.categoryLabel}</div>
      <h2>{location.name}</h2>
      <p>{location.description}</p>
      <div className="world-map-detail-meta">
        <span className={`badge world-map-category-${location.category}`}>{WORLD_MAP_CATEGORY_LABELS[location.category]}</span>
        <span className="badge secondary">x {Math.round(location.x)} / y {Math.round(location.y)}</span>
      </div>
    </article>
  );
}

function PlayerDetail({ player }) {
  const profile = player?.publicProfile || {};
  const name = getPlayerName(player);
  const meta = [
    profile.classRole,
    profile.level ? `ур. ${profile.level}` : "",
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

export default function WorldMap() {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const imageLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState({ kind: "location", id: "eldoria" });

  const visibleLocations = useMemo(() => {
    if (category === "all") return WORLD_MAP_LOCATIONS;
    return WORLD_MAP_LOCATIONS.filter((location) => location.category === category);
  }, [category]);

  const selectedLocation = selected.kind === "location"
    ? WORLD_MAP_LOCATIONS.find((location) => location.id === selected.id)
    : null;
  const selectedPlayer = selected.kind === "player"
    ? players.find((player) => player.id === selected.id)
    : null;

  const loadPlayers = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const response = await api.players();
      setPlayers(Array.isArray(response?.items) ? response.items : []);
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
    if (!mapElRef.current || mapRef.current) return undefined;

    const map = L.map(mapElRef.current, {
      crs: L.CRS.Simple,
      minZoom: -1.25,
      maxZoom: 2.5,
      zoomControl: false,
      attributionControl: false,
      maxBounds: [[-96, -96], [WORLD_MAP_SIZE + 96, WORLD_MAP_SIZE + 96]],
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
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    visibleLocations.forEach((location) => {
      const marker = L.marker(toMapLatLng(location.x, location.y), {
        icon: makeLocationIcon(location, selected.kind === "location" && selected.id === location.id),
        keyboard: true,
        title: location.name
      });
      marker.on("click", () => setSelected({ kind: "location", id: location.id }));
      marker.addTo(layer);
    });

    players.forEach((player, index) => {
      const position = getPlayerTokenPosition(index, players.length);
      const marker = L.marker(toMapLatLng(position.x, position.y), {
        icon: makePlayerIcon(player, selected.kind === "player" && selected.id === player.id),
        keyboard: true,
        title: getPlayerName(player),
        zIndexOffset: 500
      });
      marker.on("click", () => setSelected({ kind: "player", id: player.id }));
      marker.addTo(layer);
    });
  }, [players, selected, visibleLocations]);

  return (
    <div className="world-map-page">
      <section className="tf-panel world-map-hero">
        <div>
          <div className="eyebrow">Campaign map</div>
          <h1>Карта мира</h1>
          <p>Открытая карта партии: локации мира и жетоны игроков на одном листе.</p>
        </div>
        <div className="world-map-hero-actions">
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
            </div>
          </div>
          <div ref={mapElRef} className="world-map-canvas" aria-label="Интерактивная карта мира" />
        </div>

        <aside className="world-map-sidebar">
          {error ? <div className="badge off">{error}</div> : null}
          {selectedPlayer ? <PlayerDetail player={selectedPlayer} /> : null}
          {selectedLocation ? <LocationDetail location={selectedLocation} /> : null}
          {!selectedPlayer && !selectedLocation ? (
            <article className="world-map-detail-card">
              <div className="eyebrow">Выбор</div>
              <h2>Нажми на маркер</h2>
              <p>Выбери локацию или жетон игрока, чтобы открыть краткую карточку.</p>
            </article>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
