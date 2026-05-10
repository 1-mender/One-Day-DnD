import { useCallback, useMemo, useState } from "react";

function getStore() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function readPresets(key) {
  const store = getStore();
  if (!store) return [];
  try {
    const raw = store.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === "object");
  } catch {
    return [];
  }
}

function writePresets(key, values) {
  const store = getStore();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(values));
  } catch {
    // ignore storage errors
  }
}

export function useSavedFilters(scope, { limit = 6 } = {}) {
  const storageKey = `dnd_dm_saved_filters:${scope}`;
  const [presets, setPresets] = useState(() => readPresets(storageKey).slice(0, limit));

  const updatePresets = useCallback((updater) => {
    setPresets((prev) => {
      const next = updater(prev).slice(0, limit);
      writePresets(storageKey, next);
      return next;
    });
  }, [limit, storageKey]);

  const savePreset = useCallback((label, values) => {
    const normalizedLabel = String(label || "").trim();
    if (!normalizedLabel || !values || typeof values !== "object") return;
    updatePresets((prev) => {
      const withoutDuplicate = prev.filter((item) => item.label !== normalizedLabel);
      return [{
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: normalizedLabel,
        values
      }, ...withoutDuplicate];
    });
  }, [updatePresets]);

  const removePreset = useCallback((id) => {
    updatePresets((prev) => prev.filter((item) => item.id !== id));
  }, [updatePresets]);

  const hasPresets = useMemo(() => presets.length > 0, [presets]);

  return {
    hasPresets,
    presets,
    removePreset,
    savePreset
  };
}
