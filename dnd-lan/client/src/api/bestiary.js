import { ERROR_CODES, request, requestBlob, upload } from "./client.js";

function bestiaryPageRequest({ limit, cursor, q, includeImages, imagesLimit } = {}) {
  const params = new URLSearchParams();
  if (limit != null) params.set("limit", String(limit));
  if (cursor) params.set("cursor", String(cursor));
  if (q) params.set("q", String(q));
  if (includeImages) params.set("includeImages", "1");
  if (imagesLimit != null && Number(imagesLimit) > 0) params.set("imagesLimit", String(imagesLimit));
  const queryString = params.toString();
  return request(`/api/bestiary${queryString ? `?${queryString}` : ""}`, { method: "GET" });
}

export const bestiaryApi = {
  bestiary: (opts) => bestiaryPageRequest(opts),
  bestiaryPage: (opts) => bestiaryPageRequest(opts),
  bestiaryImagesBatch: (ids, { limitPer = 0 } = {}) => {
    const list = Array.isArray(ids) ? ids : [];
    const params = new URLSearchParams();
    if (list.length) params.set("ids", list.join(","));
    if (limitPer) params.set("limitPer", String(limitPer));
    const queryString = params.toString();
    return request(`/api/bestiary/images${queryString ? `?${queryString}` : ""}`, { method: "GET" });
  },
  dmBestiaryImagesBatch: (ids, { limitPer = 0 } = {}) => {
    const list = Array.isArray(ids) ? ids : [];
    const params = new URLSearchParams();
    if (list.length) params.set("ids", list.join(","));
    if (limitPer) params.set("limitPer", String(limitPer));
    const queryString = params.toString();
    return request(`/api/bestiary/dm/images${queryString ? `?${queryString}` : ""}`, { method: "GET" });
  },
  dmBestiaryCreate: (monster) => request("/api/bestiary", { method: "POST", body: JSON.stringify(monster) }),
  dmBestiaryUpdate: (id, monster) => request(`/api/bestiary/${id}`, { method: "PUT", body: JSON.stringify(monster) }),
  dmBestiaryDelete: (id) => request(`/api/bestiary/${id}`, { method: "DELETE" }),
  dmBestiaryToggle: (enabled) => request("/api/bestiary/settings/toggle", { method: "POST", body: JSON.stringify({ enabled }) }),
  dmBestiaryImages: (monsterId) => request(`/api/bestiary/${monsterId}/images`, { method: "GET" }),
  dmBestiaryUploadImage: (monsterId, file) => upload(`/api/bestiary/${monsterId}/images`, file),
  dmBestiaryDeleteImage: (imageId) => request(`/api/bestiary/images/${imageId}`, { method: "DELETE" }),
  dmBestiaryExportJson: async (withImages = true) =>
    requestBlob(`/api/bestiary/export?withImages=${withImages ? "1" : "0"}`, ERROR_CODES.EXPORT_FAILED),
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
    )
};
