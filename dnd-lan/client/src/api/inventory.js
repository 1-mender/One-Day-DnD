import { request } from "./client.js";

export const inventoryApi = {
  invMine: () => request("/api/inventory/mine", { method: "GET" }),
  invAddMine: (item) => request("/api/inventory/mine", { method: "POST", body: JSON.stringify(item) }),
  invUpdateMine: (id, item) => request(`/api/inventory/mine/${id}`, { method: "PUT", body: JSON.stringify(item) }),
  invDeleteMine: (id) => request(`/api/inventory/mine/${id}`, { method: "DELETE" }),
  invLayoutUpdateMine: (moves) =>
    request("/api/inventory/mine/layout", { method: "POST", body: JSON.stringify({ moves }) }),
  invSplitMine: (id, payload) =>
    request(`/api/inventory/mine/${id}/split`, { method: "POST", body: JSON.stringify(payload || {}) }),
  invQuickEquipMine: (id) =>
    request(`/api/inventory/mine/${id}/quick-equip`, { method: "POST" }),
  invDmGetPlayer: (playerId) => request(`/api/inventory/player/${playerId}`, { method: "GET" }),
  invDmAddToPlayer: (playerId, item) => request(`/api/inventory/dm/player/${playerId}`, { method: "POST", body: JSON.stringify(item) }),
  invDmUpdatePlayerItem: (playerId, itemId, item) =>
    request(`/api/inventory/dm/player/${playerId}/${itemId}`, { method: "PUT", body: JSON.stringify(item) }),
  invDmDeletePlayerItem: (playerId, itemId) =>
    request(`/api/inventory/dm/player/${playerId}/${itemId}`, { method: "DELETE" }),
  invDmBulkVisibility: (playerId, itemIds, visibility = "hidden") =>
    request(`/api/inventory/dm/player/${playerId}/bulk-visibility`, {
      method: "POST",
      body: JSON.stringify({ itemIds, visibility })
    }),
  invDmBulkDelete: (playerId, itemIds) =>
    request(`/api/inventory/dm/player/${playerId}/bulk-delete`, {
      method: "POST",
      body: JSON.stringify({ itemIds })
    }),
  invTransferCreate: (payload) =>
    request("/api/inventory/transfers", { method: "POST", body: JSON.stringify(payload) }),
  invTransferInbox: () =>
    request("/api/inventory/transfers/inbox", { method: "GET" }),
  invTransferOutbox: () =>
    request("/api/inventory/transfers/outbox", { method: "GET" }),
  invTransferAccept: (transferId) =>
    request(`/api/inventory/transfers/${transferId}/accept`, { method: "POST" }),
  invTransferReject: (transferId) =>
    request(`/api/inventory/transfers/${transferId}/reject`, { method: "POST" }),
  invTransferCancel: (transferId) =>
    request(`/api/inventory/transfers/${transferId}/cancel`, { method: "POST" }),
  invTransferDmList: (status = "pending") =>
    request(`/api/inventory/transfers/dm?status=${encodeURIComponent(status)}`, { method: "GET" }),
  invTransferDmCancel: (transferId) =>
    request(`/api/inventory/transfers/${transferId}/dm/cancel`, { method: "POST" })
};
