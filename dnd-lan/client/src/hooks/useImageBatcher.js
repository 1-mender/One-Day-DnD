import { useRef, useCallback } from "react";
import { api } from "../api.js";

// Simple batching hook: collect ids, debounce, call api.bestiaryImagesBatch and invoke onResult
export default function useImageBatcher(onResult, { delay = 80 } = {}) {
  const pending = useRef(new Set());
  const timer = useRef(null);

  const flush = useCallback(async (limitPer = 1) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const ids = Array.from(pending.current);
    pending.current.clear();
    if (!ids.length) return;
    try {
      const r = await api.bestiaryImagesBatch(ids, { limitPer });
      // support both legacy array shape and grouped object shape
      if (!r) return;
      if (Array.isArray(r.items)) {
        // legacy: array of images per monster? try to map
        const map = new Map((r.items || []).map((x) => [x.monsterId || x.id, x.images || []]));
        onResult(map);
      } else if (r.items && typeof r.items === "object") {
        const map = new Map();
        for (const [k, arr] of Object.entries(r.items)) map.set(Number(k), arr || []);
        onResult(map);
      }
    } catch {
      // ignore
    }
  }, [onResult]);

  const queue = useCallback((ids, limitPer = 1) => {
    for (const id of (Array.isArray(ids) ? ids : [ids])) if (id) pending.current.add(Number(id));
    if (timer.current) return;
    timer.current = setTimeout(() => flush(limitPer), delay);
  }, [delay, flush]);

  return { queue, flush };
}
