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
    })
};
