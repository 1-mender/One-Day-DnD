import test from "node:test";
import assert from "node:assert/strict";
import { decideTransfersPromotion, navUsageTestUtils, trackNavUsage } from "./navUsageMetrics.js";

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    }
  };
}

test("normalizeRoute maps nested app paths", () => {
  assert.equal(navUsageTestUtils.normalizeRoute("/app/transfers"), "/app/transfers");
  assert.equal(navUsageTestUtils.normalizeRoute("/app/transfers/123"), "/app/transfers");
  assert.equal(navUsageTestUtils.normalizeRoute("/app/unknown"), "");
});

test("decideTransfersPromotion promotes only with enough usage", () => {
  const underThreshold = decideTransfersPromotion({
    total: 20,
    routes: { "/app/transfers": 7, "/app/arcade": 1 }
  });
  assert.equal(underThreshold.promoteTransfers, false);

  const overThreshold = decideTransfersPromotion({
    total: 60,
    routes: { "/app/transfers": 12, "/app/arcade": 8 }
  });
  assert.equal(overThreshold.promoteTransfers, true);
});

test("trackNavUsage records visits into local storage", () => {
  const storage = createMemoryStorage();
  const originalWindow = globalThis.window;
  try {
    globalThis.window = { localStorage: storage };

    const now = Date.UTC(2026, 1, 24, 12, 0, 0);
    trackNavUsage("/app/inventory", now);
    const result = trackNavUsage("/app/transfers", now + 1000);

    const day = navUsageTestUtils.dayKeyAt(now);
    const raw = storage.getItem(navUsageTestUtils.STORAGE_KEY);
    const parsed = navUsageTestUtils.parseMetrics(raw);
    assert.equal(parsed.days[day]["/app/inventory"], 1);
    assert.equal(parsed.days[day]["/app/transfers"], 1);
    assert.equal(result.summary.total, 2);
  } finally {
    globalThis.window = originalWindow;
  }
});
