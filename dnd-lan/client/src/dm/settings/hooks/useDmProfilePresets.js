import { useCallback, useState } from "react";
import { api } from "../../../api.js";
import { formatError } from "../../../lib/formatError.js";
import {
  DEFAULT_PRESET_ACCESS,
  addProfilePresetItem,
  normalizePresetAccess,
  removeProfilePresetItem,
  updateProfilePresetData,
  updateProfilePresetItem
} from "../domain/presetsEditor.js";
import {
  createEmptyOriginCatalogEntry,
  createEmptyRoleCatalogEntry,
  DEFAULT_PROFILE_CATALOGS,
  normalizeProfileCatalogs
} from "../../../profileCatalogDomain.js";

export function useDmProfilePresets({ readOnly }) {
  const [profilePresets, setProfilePresets] = useState([]);
  const [presetAccess, setPresetAccess] = useState(DEFAULT_PRESET_ACCESS);
  const [profileCatalogs, setProfileCatalogs] = useState(DEFAULT_PROFILE_CATALOGS);
  const [presetBusy, setPresetBusy] = useState(false);
  const [presetMsg, setPresetMsg] = useState("");
  const [presetErr, setPresetErr] = useState("");

  const hydrateProfilePresets = useCallback((presets, access, catalogs) => {
    setProfilePresets(Array.isArray(presets) ? presets : []);
    setPresetAccess(normalizePresetAccess(access));
    setProfileCatalogs(normalizeProfileCatalogs(catalogs));
  }, []);

  function addPreset() {
    if (readOnly) return;
    setProfilePresets((prev) => addProfilePresetItem(prev));
  }

  function removePreset(index) {
    if (readOnly) return;
    setProfilePresets((prev) => removeProfilePresetItem(prev, index));
  }

  function updatePreset(index, patch) {
    if (readOnly) return;
    setProfilePresets((prev) => updateProfilePresetItem(prev, index, patch));
  }

  function updatePresetData(index, patch) {
    if (readOnly) return;
    setProfilePresets((prev) => updateProfilePresetData(prev, index, patch));
  }

  function addCatalogEntry(kind) {
    if (readOnly) return;
    setProfileCatalogs((current) => {
      const next = normalizeProfileCatalogs(current);
      if (kind === "origins") {
        return { ...next, origins: [...next.origins, createEmptyOriginCatalogEntry(next.origins.length + 1)] };
      }
      return { ...next, roles: [...next.roles, createEmptyRoleCatalogEntry(next.roles.length + 1)] };
    });
  }

  function removeCatalogEntry(kind, index) {
    if (readOnly) return;
    setProfileCatalogs((current) => {
      const next = normalizeProfileCatalogs(current);
      return { ...next, [kind]: next[kind].filter((_, itemIndex) => itemIndex !== index) };
    });
  }

  function updateCatalogEntry(kind, index, patch) {
    if (readOnly) return;
    setProfileCatalogs((current) => {
      const next = normalizeProfileCatalogs(current);
      return {
        ...next,
        [kind]: next[kind].map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
      };
    });
  }

  async function saveProfilePresets() {
    if (readOnly) return;
    setPresetErr("");
    setPresetMsg("");
    setPresetBusy(true);
    try {
      const response = await api.dmProfilePresetsUpdate({
        presets: profilePresets || [],
        access: presetAccess || {},
        catalogs: profileCatalogs || DEFAULT_PROFILE_CATALOGS
      });
      setProfilePresets(Array.isArray(response?.presets) ? response.presets : []);
      setPresetAccess(response?.access || presetAccess);
      setProfileCatalogs(normalizeProfileCatalogs(response?.catalogs));
      setPresetMsg("Пресеты сохранены.");
    } catch (e) {
      setPresetErr(formatError(e));
    } finally {
      setPresetBusy(false);
    }
  }

  return {
    profilePresets,
    presetAccess,
    setPresetAccess,
    profileCatalogs,
    presetBusy,
    presetMsg,
    presetErr,
    hydrateProfilePresets,
    addPreset,
    removePreset,
    updatePreset,
    updatePresetData,
    addCatalogEntry,
    removeCatalogEntry,
    updateCatalogEntry,
    saveProfilePresets
  };
}
