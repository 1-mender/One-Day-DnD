import test from "node:test";
import assert from "node:assert/strict";
import {
  IMP_HANDOFF_STORAGE_PREFIX,
  createImpersonationHandoffUrl,
  takeImpersonationHandoff
} from "./impersonationHandoff.js";

function createMemoryStorage(initialEntries = {}) {
  const state = new Map(Object.entries(initialEntries));
  return {
    getItem(key) {
      return state.has(key) ? state.get(key) : null;
    },
    setItem(key, value) {
      state.set(key, String(value));
    },
    removeItem(key) {
      state.delete(key);
    },
    has(key) {
      return state.has(key);
    }
  };
}

test("createImpersonationHandoffUrl stores token out-of-band and keeps token out of URL", () => {
  const storage = createMemoryStorage();
  const url = createImpersonationHandoffUrl("secret-token", {
    storageApi: storage,
    cryptoApi: { randomUUID: () => "handoff-id" },
    nowFn: () => 1000
  });

  assert.equal(url, "/app?imp=1&handoff=handoff-id");
  assert.equal(url.includes("secret-token"), false);
  assert.equal(
    storage.getItem(`${IMP_HANDOFF_STORAGE_PREFIX}handoff-id`),
    JSON.stringify({ token: "secret-token", createdAt: 1000 })
  );
});

test("takeImpersonationHandoff consumes a fresh token once", () => {
  const storage = createMemoryStorage({
    [`${IMP_HANDOFF_STORAGE_PREFIX}handoff-id`]: JSON.stringify({
      token: "player-token",
      createdAt: 1000
    })
  });

  assert.equal(takeImpersonationHandoff("handoff-id", {
    storageApi: storage,
    nowFn: () => 1500
  }), "player-token");
  assert.equal(storage.has(`${IMP_HANDOFF_STORAGE_PREFIX}handoff-id`), false);
  assert.equal(takeImpersonationHandoff("handoff-id", {
    storageApi: storage,
    nowFn: () => 1600
  }), "");
});

test("takeImpersonationHandoff rejects expired or malformed payloads and removes them", () => {
  const storage = createMemoryStorage({
    [`${IMP_HANDOFF_STORAGE_PREFIX}expired`]: JSON.stringify({
      token: "old-token",
      createdAt: 1000
    }),
    [`${IMP_HANDOFF_STORAGE_PREFIX}broken`]: "{"
  });

  assert.equal(takeImpersonationHandoff("expired", {
    storageApi: storage,
    nowFn: () => 62_000
  }), "");
  assert.equal(storage.has(`${IMP_HANDOFF_STORAGE_PREFIX}expired`), false);

  assert.equal(takeImpersonationHandoff("broken", {
    storageApi: storage,
    nowFn: () => 1200
  }), "");
  assert.equal(storage.has(`${IMP_HANDOFF_STORAGE_PREFIX}broken`), false);
});
