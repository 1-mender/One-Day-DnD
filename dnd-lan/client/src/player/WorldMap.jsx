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

function LocationDetail({ location, dmMode, savingLocationId, onVisibilityChange, onError }) {
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState(location.description || "");
  const visibility = location.visibility || "known";

  const saveDescription = async () => {
    if (!dmMode) return;
    setSavingLocationId(location.id);
    setError("");
    try {
      await api.dmUpdateLocation(location.id, { description: descriptionValue });
      setServerLocations((current) =>
        current?.map((loc) => (loc.id === location.id ? { ...loc, description: descriptionValue } : loc))
      );
      setEditingDescription(false);
      } catch (err) {
        onError?.(String(err?.message || "Не удалось обновить описание"));
    } finally {
      setSavingLocationId(null);
    }
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
            {showMapSelector && (
              <div className="world-map-map-selector">
                <h3>Выбрать карту</h3>
                {availableMaps.map((map) => (
                  <button
                    key={map.id}
                    className="btn secondary"
                    onClick={() => {
                      api.dmActivateMap(map.id).then(() => {
                        setShowMapSelector(false);
                        loadPlayers(); // reload to get new map
                      }).catch(setError);
                    }}
                  >
                    {map.name}
                  </button>
                ))}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      api.dmUploadMap(file, file.name).then(() => {
                        api.dmListMaps().then(setAvailableMaps);
                      }).catch(setError);
                    }
                  }}
                  style={{ display: 'block', marginTop: '10px' }}
                />
                <button className="btn secondary" onClick={() => setShowMapSelector(false)}>
                  Закрыть
                </button>
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
                onLocationError={setError}
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
            onLocationError={setError}
          />
          />
        </aside>
      </section>
    </div>
  );
}
