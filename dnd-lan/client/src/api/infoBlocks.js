import { request, upload } from "./client.js";

export const infoBlocksApi = {
  uploadAsset: (file) => upload("/api/info-blocks/upload", file),
  infoBlocks: () => request("/api/info-blocks", { method: "GET" }),
  dmInfoCreate: (block) => request("/api/info-blocks", { method: "POST", body: JSON.stringify(block) }),
  dmInfoUpdate: (id, block) => request(`/api/info-blocks/${id}`, { method: "PUT", body: JSON.stringify(block) }),
  dmInfoDelete: (id) => request(`/api/info-blocks/${id}`, { method: "DELETE" }),
  dmInfoUploadAsset: (file) => upload("/api/info-blocks/upload", file)
};
