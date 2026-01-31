import os from "node:os";

export function getLanIPv4() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) ips.push(net.address);
    }
  }
  return ips.sort((a, b) => scoreIp(a) - scoreIp(b));
}

function scoreIp(ip) {
  if (ip.startsWith("192.168.")) return 0;
  if (ip.startsWith("10.")) return 1;
  if (isPrivate172(ip)) return 2;
  return 3;
}

function isPrivate172(ip) {
  const parts = ip.split(".");
  if (parts.length < 2) return false;
  if (parts[0] !== "172") return false;
  const second = Number(parts[1]);
  return second >= 16 && second <= 31;
}
