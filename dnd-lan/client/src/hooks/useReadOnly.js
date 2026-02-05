import { storage } from "../api.js";
import { useSocket } from "../context/SocketContext.jsx";

export function useReadOnly() {
  const { netState } = useSocket();
  const impersonationReadOnly = storage.isImpersonating() && storage.getImpMode() === "ro";
  return impersonationReadOnly || !!netState?.degraded;
}
