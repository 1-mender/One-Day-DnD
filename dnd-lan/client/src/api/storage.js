const PLAYER_TOKEN_KEY = "dnd_player_token";
const JOIN_REQ_KEY = "dnd_join_request_id";
const IMP_FLAG_KEY = "dnd_impersonating";
const IMP_MODE_KEY = "dnd_imp_mode";

function getLocalStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function getSessionStorage() {
  try {
    return globalThis.sessionStorage || null;
  } catch {
    return null;
  }
}

function getStorageItem(store, key) {
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function setStorageItem(store, key, value) {
  if (!store) return;
  try {
    store.setItem(key, value);
  } catch {
    // ignore storage write errors
  }
}

function removeStorageItem(store, key) {
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    // ignore storage write errors
  }
}

const localStore = getLocalStorage();
const sessionStore = getSessionStorage();

let playerTokenMemory =
  getStorageItem(sessionStore, PLAYER_TOKEN_KEY)
  || getStorageItem(localStore, PLAYER_TOKEN_KEY)
  || "";

if (playerTokenMemory) {
  removeStorageItem(sessionStore, PLAYER_TOKEN_KEY);
  removeStorageItem(localStore, PLAYER_TOKEN_KEY);
}

export const storage = {
  getPlayerToken: () => playerTokenMemory,
  setPlayerToken: (t, scope = "memory") => {
    playerTokenMemory = String(t || "");
    removeStorageItem(sessionStore, PLAYER_TOKEN_KEY);
    removeStorageItem(localStore, PLAYER_TOKEN_KEY);
    if (!playerTokenMemory) return;
    if (scope === "session") {
      setStorageItem(sessionStore, PLAYER_TOKEN_KEY, playerTokenMemory);
      return;
    }
    if (scope === "local") {
      setStorageItem(localStore, PLAYER_TOKEN_KEY, playerTokenMemory);
    }
  },
  clearPlayerToken: () => {
    playerTokenMemory = "";
    removeStorageItem(sessionStore, PLAYER_TOKEN_KEY);
    removeStorageItem(localStore, PLAYER_TOKEN_KEY);
  },
  getJoinRequestId: () => getStorageItem(localStore, JOIN_REQ_KEY),
  setJoinRequestId: (id) => setStorageItem(localStore, JOIN_REQ_KEY, String(id || "")),
  clearJoinRequestId: () => removeStorageItem(localStore, JOIN_REQ_KEY),
  isImpersonating: () => getStorageItem(sessionStore, IMP_FLAG_KEY) === "1",
  setImpersonating: (v) => setStorageItem(sessionStore, IMP_FLAG_KEY, v ? "1" : "0"),
  clearImpersonating: () => removeStorageItem(sessionStore, IMP_FLAG_KEY),
  getImpMode: () => getStorageItem(sessionStore, IMP_MODE_KEY) || "ro",
  setImpMode: (m) => setStorageItem(sessionStore, IMP_MODE_KEY, m === "rw" ? "rw" : "ro"),
  clearImpMode: () => removeStorageItem(sessionStore, IMP_MODE_KEY)
};
