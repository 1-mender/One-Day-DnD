import { request } from "./client.js";

export const profileApi = {
  playerProfile: (playerId) => request(`/api/players/${playerId}/profile`, { method: "GET" }),
  playerPublicProfile: (playerId) => request(`/api/players/${playerId}/public-profile`, { method: "GET" }),
  dmUpdatePlayerProfile: (playerId, profile) =>
    request(`/api/players/${playerId}/profile`, { method: "PUT", body: JSON.stringify(profile) }),
  dmAwardProfileXp: (playerId, payload) =>
    request(`/api/players/${playerId}/profile/xp`, { method: "POST", body: JSON.stringify(payload) }),
  playerPatchProfile: (playerId, patch) =>
    request(`/api/players/${playerId}/profile`, { method: "PATCH", body: JSON.stringify(patch) }),
  playerProfileRequest: (playerId, proposedChanges, reason = "") =>
    request(`/api/players/${playerId}/profile-requests`, { method: "POST", body: JSON.stringify({ proposedChanges, reason }) }),
  dmProfileRequests: (status = "pending") =>
    request(`/api/profile-requests?status=${encodeURIComponent(status)}`, { method: "GET" }),
  dmApproveProfileRequest: (requestId, note = "") =>
    request(`/api/profile-requests/${requestId}/approve`, { method: "POST", body: JSON.stringify({ note }) }),
  dmRejectProfileRequest: (requestId, note = "") =>
    request(`/api/profile-requests/${requestId}/reject`, { method: "POST", body: JSON.stringify({ note }) }),
  profilePresets: () => request("/api/profile-presets", { method: "GET" }),
  dmProfilePresets: () => request("/api/profile-presets/dm", { method: "GET" }),
  dmProfilePresetsUpdate: (payload) =>
    request("/api/profile-presets/dm", { method: "PUT", body: JSON.stringify(payload) }),
  playerProfileRequests: (playerId, { status = "", limit = 5 } = {}) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (limit) params.set("limit", String(limit));
    const queryString = params.toString();
    return request(`/api/players/${playerId}/profile-requests${queryString ? `?${queryString}` : ""}`, { method: "GET" });
  }
};
