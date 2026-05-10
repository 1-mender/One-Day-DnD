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

export function useDmProfilePresets({ readOnly }) {
  const [profilePresets, setProfilePresets] = useState([]);
  const [presetAccess, setPresetAccess] = useState(DEFAULT_PRESET_ACCESS);
  const [presetBusy, setPresetBusy] = useState(false);
  const [presetMsg, setPresetMsg] = useState("");
  const [presetErr, setPresetErr] = useState("");

  const hydrateProfilePresets = useCallback((presets, access) => {
    setProfilePresets(Array.isArray(presets) ? presets : []);
    setPresetAccess(normalizePresetAccess(access));
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

  async function saveProfilePresets() {
    if (readOnly) return;
    setPresetErr("");
    setPresetMsg("");
    setPresetBusy(true);
    try {
      const response = await api.dmProfilePresetsUpdate({
        presets: profilePresets || [],
        access: presetAccess || {}
      });
      setProfilePresets(Array.isArray(response?.presets) ? response.presets : []);
      setPresetAccess(response?.access || presetAccess);
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
    presetBusy,
    presetMsg,
    presetErr,
    hydrateProfilePresets,
    addPreset,
    removePreset,
    updatePreset,
    updatePresetData,
    saveProfilePresets
  };
}
