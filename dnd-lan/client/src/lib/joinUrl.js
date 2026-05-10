function isLocalHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

export function resolveJoinUrl(info) {
  const fallback = "http://<LAN-IP>:3000";
  const ips = Array.isArray(info?.ips) ? info.ips.filter(Boolean) : [];
  const lanIp = String(ips[0] || "");
  const serverPort = Number(info?.port || 3000);

  if (typeof window !== "undefined") {
    const protocol = String(window.location?.protocol || "http:");
    const hostname = String(window.location?.hostname || "");
    const host = String(window.location?.host || "");
    const uiPort = Number(window.location?.port || 0);

    if ((protocol === "http:" || protocol === "https:") && !isLocalHost(hostname) && host) {
      return `${protocol}//${host}`;
    }

    // If UI is opened on localhost in dev, provide LAN IP with the same UI port (e.g. :5173).
    if ((protocol === "http:" || protocol === "https:") && isLocalHost(hostname) && lanIp && uiPort > 0 && uiPort !== serverPort) {
      return `${protocol}//${lanIp}:${uiPort}`;
    }
  }

  const urls = Array.isArray(info?.urls) ? info.urls : [];
  if (urls[0]) return String(urls[0]);
  if (lanIp) return `http://${lanIp}:${serverPort || 3000}`;
  return fallback;
}
