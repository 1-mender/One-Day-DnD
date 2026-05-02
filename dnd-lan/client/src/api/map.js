import { request } from "./client.js";

export const mapApi = {
  worldMapState: () => request("/api/map/state", { method: "GET" }),
  dmUpdateMapPosition: (playerId, position) =>
    request(`/api/map/players/${playerId}/position`, {
      method: "PUT",
      body: JSON.stringify(position)
    }),
  dmUpdateLocationState: (locationId, state) =>
    request(`/api/map/locations/${encodeURIComponent(locationId)}/state`, {
      method: "PUT",
      body: JSON.stringify(state)
    }),
  dmUpdateLocationPosition: (locationId, position) =>
    request(`/api/map/locations/${encodeURIComponent(locationId)}/position`, {
      method: "PUT",
      body: JSON.stringify(position)
    })
  ,
  // New DM CRUD for editable locations
  dmListLocations: () => request(`/api/map/locations`, { method: "GET" }),
  dmCreateLocation: (payload) => request(`/api/map/locations`, { method: "POST", body: JSON.stringify(payload) }),
  dmUpdateLocation: (id, payload) => request(`/api/map/locations/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
  dmDeleteLocation: (id) => request(`/api/map/locations/${encodeURIComponent(id)}`, { method: "DELETE" }),
  // New DM CRUD for tokens
  dmListTokens: () => request(`/api/map/tokens`, { method: "GET" }),
  dmCreateToken: (payload) => request(`/api/map/tokens`, { method: "POST", body: JSON.stringify(payload) }),
  dmUpdateToken: (id, payload) => request(`/api/map/tokens/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
  dmDeleteToken: (id) => request(`/api/map/tokens/${encodeURIComponent(id)}`, { method: "DELETE" })
};
