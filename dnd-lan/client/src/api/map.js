import { request, uploadForm } from "./client.js";
import { ERROR_CODES } from "../lib/errorCodes.js";

/**
 * API for players to get map state.
 */
export const mapApi = {
  worldMapState: () => request("/api/map/state", { method: "GET" })
};

/**
 * API for Dungeon Masters to manage and edit maps.
 */
export const mapAdminApi = {
  // Map file management
  dmListMaps: () => request(`/api/map/maps`, { method: "GET" }),
  dmUploadMap: (file, name) => {
    const formData = new FormData();
    formData.append("file", file);
    if (name) formData.append("name", name);
    return uploadForm("/api/map/maps", formData, ERROR_CODES.UPLOAD_FAILED);
  },
  dmActivateMap: (id) => request(`/api/map/maps/${encodeURIComponent(id)}/activate`, { method: "PUT" }),

  // Player position on map
  dmUpdateMapPosition: (playerId, position) =>
    request(`/api/map/players/${playerId}/position`, {
      method: "PUT",
      body: JSON.stringify(position)
    }),

  // Editable locations CRUD and state
  dmListLocations: () => request(`/api/map/locations`, { method: "GET" }),
  dmCreateLocation: (payload) => request(`/api/map/locations`, { method: "POST", body: JSON.stringify(payload) }),
  dmUpdateLocation: (id, payload) => request(`/api/map/locations/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
  dmDeleteLocation: (id) => request(`/api/map/locations/${encodeURIComponent(id)}`, { method: "DELETE" }),
  dmUpdateLocationState: (locationId, state) =>
    request(`/api/map/locations/${encodeURIComponent(locationId)}/state`, {
      method: "PUT",
      body: JSON.stringify(state)
    }),
  dmUpdateLocationPosition: (locationId, position) =>
    request(`/api/map/locations/${encodeURIComponent(locationId)}/position`, {
      method: "PUT",
      body: JSON.stringify(position)
    }),

  // Editable tokens CRUD
  dmListTokens: () => request(`/api/map/tokens`, { method: "GET" }),
  dmCreateToken: (payload) => request(`/api/map/tokens`, { method: "POST", body: JSON.stringify(payload) }),
  dmUpdateToken: (id, payload) => request(`/api/map/tokens/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
  dmDeleteToken: (id) => request(`/api/map/tokens/${encodeURIComponent(id)}`, { method: "DELETE" })
};
