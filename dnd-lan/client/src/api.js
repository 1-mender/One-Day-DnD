const PLAYER_TOKEN_KEY = "dnd_player_token";
const JOIN_REQ_KEY = "dnd_join_request_id";
const IMP_FLAG_KEY = "dnd_impersonating";
const IMP_MODE_KEY = "dnd_imp_mode";

export const storage = {
  getPlayerToken: () => sessionStorage.getItem(PLAYER_TOKEN_KEY) || localStorage.getItem(PLAYER_TOKEN_KEY),
  setPlayerToken: (t, scope = "local") => {
    if (scope === "session") sessionStorage.setItem(PLAYER_TOKEN_KEY, t);
    else localStorage.setItem(PLAYER_TOKEN_KEY, t);
  },
  clearPlayerToken: () => {
    sessionStorage.removeItem(PLAYER_TOKEN_KEY);
    localStorage.removeItem(PLAYER_TOKEN_KEY);
  },
  getJoinRequestId: () => localStorage.getItem(JOIN_REQ_KEY),
  setJoinRequestId: (id) => localStorage.setItem(JOIN_REQ_KEY, id),
  clearJoinRequestId: () => localStorage.removeItem(JOIN_REQ_KEY),

  isImpersonating: () => sessionStorage.getItem(IMP_FLAG_KEY) === "1",
  setImpersonating: (v) => sessionStorage.setItem(IMP_FLAG_KEY, v ? "1" : "0"),
  clearImpersonating: () => sessionStorage.removeItem(IMP_FLAG_KEY),

  getImpMode: () => sessionStorage.getItem(IMP_MODE_KEY) || "ro",
  setImpMode: (m) => sessionStorage.setItem(IMP_MODE_KEY, m === "rw" ? "rw" : "ro"),
  clearImpMode: () => sessionStorage.removeItem(IMP_MODE_KEY)
};

async function request(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const token = storage.getPlayerToken();
  if (token) headers["x-player-token"] = token;

  const res = await fetch(path, {
    ...opts,
    headers,
    credentials: "include"
  });
  const ct = res.headers.get("content-type") || "";
  const body = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) throw Object.assign(new Error(body?.error || "request_failed"), { status: res.status, body });
  return body;
}

async function upload(path, file) {
  const fd = new FormData();
  fd.append("file", file);
  const headers = {};
  const token = storage.getPlayerToken();
  if (token) headers["x-player-token"] = token;
  const res = await fetch(path, { method: "POST", body: fd, headers, credentials: "include" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body?.error || "upload_failed"), { status: res.status, body });
  return body;
}

export const api = {
  serverInfo: () => request("/api/server/info", { method: "GET" }),
  dmSetup: (username, password) => request("/api/dm/setup", { method: "POST", body: JSON.stringify({ username, password }) }),
  dmLogin: (username, password) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  dmLogout: () => request("/api/auth/logout", { method: "POST" }),
  dmMe: () => request("/api/auth/me", { method: "GET" }),
  dmChangePassword: (newPassword) => request("/api/auth/change-password", { method: "POST", body: JSON.stringify({ newPassword }) }),

  joinRequest: (displayName, joinCode) => request("/api/party/join-request", { method: "POST", body: JSON.stringify({ displayName, joinCode }) }),
  dmRequests: () => request("/api/party/requests", { method: "GET" }),
  dmApprove: (joinRequestId) => request("/api/party/approve", { method: "POST", body: JSON.stringify({ joinRequestId }) }),
  dmReject: (joinRequestId) => request("/api/party/reject", { method: "POST", body: JSON.stringify({ joinRequestId }) }),
  dmBan: (joinRequestId) => request("/api/party/ban", { method: "POST", body: JSON.stringify({ joinRequestId }) }),
  dmKick: (playerId) => request("/api/party/kick", { method: "POST", body: JSON.stringify({ playerId }) }),
  dmGetJoinCode: () => request("/api/party/join-code", { method: "GET" }),
  dmSetJoinCode: (joinCode) => request("/api/party/join-code", { method: "POST", body: JSON.stringify({ joinCode }) }),
  dmImpersonate: (playerId, mode = "ro") =>
    request("/api/party/impersonate", { method: "POST", body: JSON.stringify({ playerId, mode }) }),

  players: () => request("/api/players", { method: "GET" }),
  me: () => request("/api/players/me", { method: "GET" }),
  dmPlayers: () => request("/api/players/dm/list", { method: "GET" }),
  playerProfile: (playerId) => request(`/api/players/${playerId}/profile`, { method: "GET" }),
  dmUpdatePlayerProfile: (playerId, profile) =>
    request(`/api/players/${playerId}/profile`, { method: "PUT", body: JSON.stringify(profile) }),
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
  playerProfileRequests: (playerId, { status = "", limit = 5 } = {}) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (limit) sp.set("limit", String(limit));
    const qs = sp.toString();
    return request(`/api/players/${playerId}/profile-requests${qs ? `?${qs}` : ""}`, { method: "GET" });
  },
  uploadAsset: (file) => upload("/api/info-blocks/upload", file),

  invMine: () => request("/api/inventory/mine", { method: "GET" }),
  invAddMine: (item) => request("/api/inventory/mine", { method: "POST", body: JSON.stringify(item) }),
  invUpdateMine: (id, item) => request(`/api/inventory/mine/${id}`, { method: "PUT", body: JSON.stringify(item) }),
  invDeleteMine: (id) => request(`/api/inventory/mine/${id}`, { method: "DELETE" }),
  invDmGetPlayer: (playerId) => request(`/api/inventory/player/${playerId}`, { method: "GET" }),
  invDmAddToPlayer: (playerId, item) => request(`/api/inventory/dm/player/${playerId}`, { method: "POST", body: JSON.stringify(item) }),

  bestiary: () => request("/api/bestiary", { method: "GET" }),
  dmBestiaryCreate: (m) => request("/api/bestiary", { method: "POST", body: JSON.stringify(m) }),
  dmBestiaryUpdate: (id, m) => request(`/api/bestiary/${id}`, { method: "PUT", body: JSON.stringify(m) }),
  dmBestiaryDelete: (id) => request(`/api/bestiary/${id}`, { method: "DELETE" }),
  dmBestiaryToggle: (enabled) => request("/api/bestiary/settings/toggle", { method: "POST", body: JSON.stringify({ enabled }) }),
  dmBestiaryImages: (monsterId) => request(`/api/bestiary/${monsterId}/images`, { method: "GET" }),
  dmBestiaryUploadImage: (monsterId, file) => upload(`/api/bestiary/${monsterId}/images`, file),
  dmBestiaryDeleteImage: (imageId) => request(`/api/bestiary/images/${imageId}`, { method: "DELETE" }),
  dmBestiaryExportJson: async (withImages = true) => {
    const res = await fetch(`/api/bestiary/export?withImages=${withImages ? "1" : "0"}`, { credentials: "include" });
    if (!res.ok) throw new Error("export_failed");
    return await res.blob();
  },
  dmBestiaryImportJson: (file, {
    mode = "merge",
    match = "name",
    onExisting = "update",
    imagesMeta = false,
    dryRun = false
  } = {}) =>
    upload(
      `/api/bestiary/import?mode=${encodeURIComponent(mode)}&match=${encodeURIComponent(match)}&onExisting=${encodeURIComponent(onExisting)}&imagesMeta=${imagesMeta ? "1" : "0"}&dryRun=${dryRun ? "1" : "0"}`,
      file
    ),

  dmEventsList: async ({
    limit = 200,
    offset = 0,
    q = "",
    type = "",
    prefix = "",
    actorRole = "",
    playerId = "",
    since = ""
  } = {}) => {
    const sp = new URLSearchParams();
    sp.set("limit", String(limit));
    sp.set("offset", String(offset));
    if (q) sp.set("q", q);
    if (type) sp.set("type", type);
    if (prefix) sp.set("prefix", prefix);
    if (actorRole) sp.set("actorRole", actorRole);
    if (playerId) sp.set("playerId", String(playerId));
    if (since) sp.set("since", String(since));
    return request(`/api/events?${sp.toString()}`, { method: "GET" });
  },
  dmEventsExportJson: async ({
    q = "",
    type = "",
    prefix = "",
    actorRole = "",
    playerId = "",
    since = "",
    max = 20000
  } = {}) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (type) sp.set("type", type);
    if (prefix) sp.set("prefix", prefix);
    if (actorRole) sp.set("actorRole", actorRole);
    if (playerId) sp.set("playerId", String(playerId));
    if (since) sp.set("since", String(since));
    sp.set("max", String(max));

    const res = await fetch(`/api/events/export?${sp.toString()}`, { credentials: "include" });
    if (!res.ok) throw new Error("export_failed");
    return await res.blob();
  },
  dmEventsCleanup: (payload) =>
    request("/api/events/cleanup", { method: "POST", body: JSON.stringify(payload) }),

  infoBlocks: () => request("/api/info-blocks", { method: "GET" }),
  dmInfoCreate: (b) => request("/api/info-blocks", { method: "POST", body: JSON.stringify(b) }),
  dmInfoUpdate: (id, b) => request(`/api/info-blocks/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  dmInfoDelete: (id) => request(`/api/info-blocks/${id}`, { method: "DELETE" }),
  dmInfoUploadAsset: (file) => upload("/api/info-blocks/upload", file),

  exportZip: async () => {
    const res = await fetch("/api/backup/export", { credentials: "include" });
    if (!res.ok) throw new Error("export_failed");
    const blob = await res.blob();
    return blob;
  },
  importZip: async (file) => {
    const fd = new FormData();
    fd.append("zip", file);
    const res = await fetch("/api/backup/import", { method: "POST", body: fd, credentials: "include" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body?.error || "import_failed"), { body });
    return body;
  }
};
