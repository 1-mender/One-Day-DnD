export const IMP_HANDOFF_STORAGE_PREFIX = "dnd.impersonation.handoff.";
export const IMP_HANDOFF_TTL_MS = 60_000;

function resolveStorage(storageApi) {
  if (storageApi) return storageApi;
  return globalThis.window?.localStorage || null;
}

function resolveCrypto(cryptoApi) {
  if (cryptoApi) return cryptoApi;
  return globalThis.window?.crypto || null;
}

export function createImpersonationHandoffUrl(
  token,
  {
    storageApi,
    cryptoApi,
    nowFn = () => Date.now()
  } = {}
) {
  const storage = resolveStorage(storageApi);
  const handoffId = resolveCrypto(cryptoApi)?.randomUUID?.() || `${nowFn()}_${Math.random().toString(16).slice(2)}`;
  if (!storage?.setItem) throw new Error("handoff_storage_unavailable");
  storage.setItem(
    `${IMP_HANDOFF_STORAGE_PREFIX}${handoffId}`,
    JSON.stringify({
      token: String(token || ""),
      createdAt: Number(nowFn())
    })
  );
  return `/app?imp=1&handoff=${encodeURIComponent(handoffId)}`;
}

export function takeImpersonationHandoff(
  handoffId,
  {
    storageApi,
    nowFn = () => Date.now()
  } = {}
) {
  const safeId = String(handoffId || "").trim();
  if (!safeId) return "";
  const storage = resolveStorage(storageApi);
  if (!storage?.getItem || !storage?.removeItem) return "";
  const key = `${IMP_HANDOFF_STORAGE_PREFIX}${safeId}`;
  try {
    const raw = storage.getItem(key);
    storage.removeItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    const token = String(parsed?.token || "");
    const createdAt = Number(parsed?.createdAt || 0);
    if (!token || !Number.isFinite(createdAt) || Number(nowFn()) - createdAt > IMP_HANDOFF_TTL_MS) {
      return "";
    }
    return token;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // best-effort cleanup
    }
    return "";
  }
}
