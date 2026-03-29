import { useCallback, useMemo, useState } from "react";

function getStore() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function readIds(key) {
  const store = getStore();
  if (!store) return [];
  try {
    const raw = store.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);
  } catch {
    return [];
  }
}

function writeIds(key, values) {
  const store = getStore();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(values));
  } catch {
    // ignore storage write errors
  }
}

export function useQuickAccess(scope, items, { limit = 6 } = {}) {
  const pinsKey = `dnd_dm_quick_pins:${scope}`;
  const recentKey = `dnd_dm_quick_recent:${scope}`;
  const [pinnedIds, setPinnedIds] = useState(() => readIds(pinsKey).slice(0, limit));
  const [recentIds, setRecentIds] = useState(() => readIds(recentKey).slice(0, limit));

  const itemMap = useMemo(() => {
    const map = new Map();
    for (const item of items || []) {
      const id = Number(item?.id);
      if (Number.isFinite(id) && id > 0) map.set(id, item);
    }
    return map;
  }, [items]);

  const updatePinned = useCallback((updater) => {
    setPinnedIds((prev) => {
      const next = updater(prev).slice(0, limit);
      writeIds(pinsKey, next);
      return next;
    });
  }, [limit, pinsKey]);

  const updateRecent = useCallback((updater) => {
    setRecentIds((prev) => {
      const next = updater(prev).slice(0, limit);
      writeIds(recentKey, next);
      return next;
    });
  }, [limit, recentKey]);

  const togglePinned = useCallback((id) => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) return;
    updatePinned((prev) => (
      prev.includes(numericId)
        ? prev.filter((value) => value !== numericId)
        : [numericId, ...prev.filter((value) => value !== numericId)]
    ));
  }, [updatePinned]);

  const trackRecent = useCallback((id) => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) return;
    updateRecent((prev) => {
      if (prev[0] === numericId) return prev;
      return [numericId, ...prev.filter((value) => value !== numericId)];
    });
  }, [updateRecent]);

  const isPinned = useCallback((id) => pinnedIds.includes(Number(id)), [pinnedIds]);

  const pinnedItems = useMemo(() => (
    pinnedIds.map((id) => itemMap.get(id)).filter(Boolean)
  ), [itemMap, pinnedIds]);

  const recentItems = useMemo(() => (
    recentIds
      .filter((id) => !pinnedIds.includes(id))
      .map((id) => itemMap.get(id))
      .filter(Boolean)
  ), [itemMap, pinnedIds, recentIds]);

  return {
    isPinned,
    pinnedItems,
    recentItems,
    togglePinned,
    trackRecent
  };
}
