export const DEFAULT_WORLD_MAP_URL = "/api/map/default-image";

export const WORLD_MAP_SOCKET_EVENTS = [
  "map:state",
  "map:mapsUpdated",
  "map:positionUpdated",
  "map:locationUpdated",
  "map:locationCreated",
  "map:locationDeleted",
  "map:tokenCreated",
  "map:tokenUpdated",
  "map:tokenDeleted"
];

export function resolveWorldMapImageUrl(response) {
  const directUrl = String(
    response?.map?.imageUrl
    || response?.map?.url
    || response?.activeMap?.imageUrl
    || response?.activeMap?.url
    || response?.maps?.[0]?.url
    || ""
  ).trim();
  if (directUrl) return directUrl;

  const filename = String(response?.maps?.[0]?.filename || "").trim();
  if (filename) return `/uploads/maps/${filename}`;

  return DEFAULT_WORLD_MAP_URL;
}

export function resolveWorldMapDimensions(response) {
  const width = Number(response?.map?.width || response?.activeMap?.width || 0);
  const height = Number(response?.map?.height || response?.activeMap?.height || 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}
