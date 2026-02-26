export const DEFAULT_PRESET_ACCESS = Object.freeze({
  enabled: true,
  playerEdit: true,
  playerRequest: true,
  hideLocal: false
});

export function normalizePresetAccess(access) {
  return {
    enabled: access?.enabled !== false,
    playerEdit: access?.playerEdit !== false,
    playerRequest: access?.playerRequest !== false,
    hideLocal: !!access?.hideLocal
  };
}

function createProfilePresetDraft() {
  return {
    title: "Новый пресет",
    subtitle: "",
    data: {
      characterName: "",
      classRole: "",
      level: "",
      stats: {},
      bio: "",
      avatarUrl: ""
    }
  };
}

export function addProfilePresetItem(list) {
  return [...(Array.isArray(list) ? list : []), createProfilePresetDraft()];
}

export function removeProfilePresetItem(list, idx) {
  return (Array.isArray(list) ? list : []).filter((_, i) => i !== idx);
}

export function updateProfilePresetItem(list, idx, patch) {
  return (Array.isArray(list) ? list : []).map((p, i) => (i === idx ? { ...p, ...(patch || {}) } : p));
}

export function updateProfilePresetData(list, idx, patch) {
  return (Array.isArray(list) ? list : []).map((p, i) => (
    i === idx
      ? { ...p, data: { ...(p?.data || {}), ...(patch || {}) } }
      : p
  ));
}
