import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api.js";
import { useToast } from "../../foundation/providers/index.js";
import { useSocket } from "../../context/SocketContext.jsx";
import { useReadOnly } from "../../hooks/useReadOnly.js";
import { formatError } from "../../lib/formatError.js";
import {
  EMPTY_PROFILE_DRAFT,
  diffProfile,
  getRaceBonus,
  getRaceLabel,
  getRaceValue,
  mergePresets
} from "../profileDomain.js";

const DEFAULT_PRESET_ACCESS = {
  enabled: false,
  playerEdit: false,
  playerRequest: false,
  hideLocal: false
};

const PROFILE_FIELDS = [
  "characterName",
  "classRole",
  "level",
  "stats",
  "bio",
  "avatarUrl"
];

export function useProfileController() {
  const toast = useToast();
  const { socket } = useSocket();
  const readOnly = useReadOnly();

  const [playerId, setPlayerId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [notCreated, setNotCreated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editMode, setEditMode] = useState("");
  const [draft, setDraft] = useState(EMPTY_PROFILE_DRAFT);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestDraft, setRequestDraft] = useState(EMPTY_PROFILE_DRAFT);
  const [requestReason, setRequestReason] = useState("");
  const [requests, setRequests] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqStatus, setReqStatus] = useState("all");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [requestsRef] = useAutoAnimate({ duration: 200 });
  const reqStatusRef = useRef(reqStatus);
  const [globalPresets, setGlobalPresets] = useState([]);
  const [presetAccess, setPresetAccess] = useState(DEFAULT_PRESET_ACCESS);

  useEffect(() => {
    reqStatusRef.current = reqStatus;
  }, [reqStatus]);

  const loadRequests = useCallback(async (pid, status) => {
    if (!pid) return;
    setReqLoading(true);
    try {
      const response = await api.playerProfileRequests(pid, {
        limit: 10,
        status: status === "all" ? "" : status
      });
      setRequests(response.items || []);
    } catch {
      setRequests([]);
    } finally {
      setReqLoading(false);
    }
  }, []);

  const loadPresets = useCallback(async () => {
    try {
      const response = await api.profilePresets();
      setGlobalPresets(Array.isArray(response?.presets) ? response.presets : []);
      setPresetAccess({
        enabled: response?.access?.enabled !== false,
        playerEdit: response?.access?.playerEdit !== false,
        playerRequest: response?.access?.playerRequest !== false,
        hideLocal: !!response?.access?.hideLocal
      });
    } catch {
      setGlobalPresets([]);
      setPresetAccess(DEFAULT_PRESET_ACCESS);
    }
  }, []);

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const me = await api.me();
      const pid = me?.player?.id;
      if (!pid) throw new Error("player_not_found");
      setPlayerId(pid);
      const response = await api.playerProfile(pid);
      if (response.notCreated) {
        setProfile(null);
        setNotCreated(true);
      } else {
        setProfile(response.profile);
        setNotCreated(false);
      }
      await loadRequests(pid, reqStatusRef.current);
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setLoading(false);
    }
  }, [loadRequests]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const loadPresetsRef = useRef(loadPresets);
  useEffect(() => {
    loadPresetsRef.current = loadPresets;
  }, [loadPresets]);

  useEffect(() => {
    if (!socket) return () => {};
    loadRef.current?.().catch(() => {});
    loadPresetsRef.current?.().catch(() => {});
    const onUpdated = () => loadRef.current?.().catch(() => {});
    const onSettings = () => loadPresetsRef.current?.().catch(() => {});
    const onRequestsUpdated = () => loadRef.current?.().catch(() => {});
    socket.on("profile:updated", onUpdated);
    socket.on("profile:requestsUpdated", onRequestsUpdated);
    socket.on("settings:updated", onSettings);
    return () => {
      socket.off("profile:updated", onUpdated);
      socket.off("profile:requestsUpdated", onRequestsUpdated);
      socket.off("settings:updated", onSettings);
    };
  }, [socket]);

  useEffect(() => {
    if (playerId) loadRequests(playerId, reqStatus).catch(() => {});
  }, [playerId, reqStatus, loadRequests]);

  const editableFields = useMemo(() => profile?.editableFields || [], [profile?.editableFields]);
  const allowRequests = !!profile?.allowRequests;
  const requestableFields = useMemo(
    () => PROFILE_FIELDS.filter((field) => !editableFields.includes(field)),
    [editableFields]
  );
  const canEdit = useCallback(
    (field) => editableFields.includes(field) && !readOnly,
    [editableFields, readOnly]
  );
  const canEditBasic = ["characterName", "classRole", "level"].some((field) => canEdit(field));
  const canEditAny = editableFields.length > 0 && !readOnly;
  const canRequestAny = requestableFields.length > 0 && allowRequests && !readOnly;

  const openEdit = useCallback(
    (mode) => {
      if (!profile) return;
      setEditMode(mode);
      setDraft(createDraftFromProfile(profile));
    },
    [profile]
  );

  const saveEdit = useCallback(async () => {
    if (!playerId || !profile) return;
    const patch = {};
    if (editMode === "basic") {
      if (canEdit("characterName")) patch.characterName = draft.characterName;
      if (canEdit("classRole")) patch.classRole = draft.classRole;
      if (canEdit("level")) patch.level = draft.level === "" ? null : Number(draft.level);
    }
    if (editMode === "stats" && canEdit("stats")) patch.stats = draft.stats || {};
    if (editMode === "bio" && canEdit("bio")) patch.bio = draft.bio || "";
    if (editMode === "avatar" && canEdit("avatarUrl")) patch.avatarUrl = draft.avatarUrl || "";
    if (!Object.keys(patch).length) return;

    setErr("");
    try {
      const response = await api.playerPatchProfile(playerId, patch);
      setProfile(response.profile);
      setEditMode("");
      toast.success("Профиль обновлён");
    } catch (e) {
      const message = formatError(e);
      setErr(message);
      toast.error(message);
    }
  }, [canEdit, draft, editMode, playerId, profile, toast]);

  const handleAvatarFileChange = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const response = await api.uploadAsset(file);
        setDraft((current) => ({ ...current, avatarUrl: response.url || "" }));
        toast.success("Аватар загружен");
      } catch (e) {
        const message = formatError(e);
        setErr(message);
        toast.error(message);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [toast]
  );

  const openRequest = useCallback(() => {
    if (!profile) return;
    setRequestDraft(createDraftFromProfile(profile));
    setRequestReason("");
    setRequestOpen(true);
  }, [profile]);

  const applyEditPreset = useCallback((preset) => {
    setDraft((current) => mergeAllowedPreset(current, preset, editableFields));
  }, [editableFields]);

  const applyRequestPreset = useCallback((preset) => {
    setRequestDraft((current) => mergeAllowedPreset(current, preset, requestableFields));
  }, [requestableFields]);

  const submitRequest = useCallback(async () => {
    if (!playerId || !profile) return;
    const changes = diffProfile(profile, requestDraft);
    if (!Object.keys(changes).length) {
      toast.warn("Нет изменений для запроса");
      return;
    }
    setErr("");
    try {
      await api.playerProfileRequest(playerId, changes, requestReason);
      setRequestOpen(false);
      await loadRequests(playerId, reqStatusRef.current);
      toast.success("Запрос отправлен");
    } catch (e) {
      const message = formatError(e);
      setErr(message);
      toast.error(message);
    }
  }, [loadRequests, playerId, profile, requestDraft, requestReason, toast]);

  const updatedLabel = profile?.updatedAt ? new Date(profile.updatedAt).toLocaleString() : "-";
  const raceValue = getRaceValue(profile?.stats);
  const raceLabel = getRaceLabel(raceValue);
  const raceBonus = getRaceBonus(raceValue);
  const raceBonusLabel = raceBonus > 0 ? `+${raceBonus}` : String(raceBonus);
  const raceHint = `Бонус лимита веса: ${raceBonusLabel}`;
  const allowGlobalEdit = !!presetAccess?.enabled && !!presetAccess?.playerEdit;
  const allowGlobalRequest = !!presetAccess?.enabled && !!presetAccess?.playerRequest;
  const editPresets = useMemo(
    () => mergePresets(globalPresets, allowGlobalEdit, presetAccess?.hideLocal),
    [globalPresets, allowGlobalEdit, presetAccess?.hideLocal]
  );
  const requestPresets = useMemo(
    () => mergePresets(globalPresets, allowGlobalRequest, presetAccess?.hideLocal),
    [globalPresets, allowGlobalRequest, presetAccess?.hideLocal]
  );

  return {
    allowRequests,
    canEdit,
    canEditAny,
    canEditBasic,
    canRequestAny,
    draft,
    editMode,
    editPresets,
    editableFields,
    err,
    fileInputRef,
    handleAvatarFileChange,
    load,
    loadRequests,
    loading,
    notCreated,
    openEdit,
    openRequest,
    playerId,
    presetAccess,
    profile,
    requestableFields,
    raceBonus,
    raceBonusLabel,
    raceHint,
    raceLabel,
    raceValue,
    readOnly,
    reqLoading,
    reqStatus,
    requestDraft,
    requestOpen,
    requestPresets,
    requestReason,
    requests,
    requestsRef,
    saveEdit,
    applyEditPreset,
    applyRequestPreset,
    setDraft,
    setEditMode,
    setRequestDraft,
    setRequestOpen,
    setRequestReason,
    setReqStatus,
    submitRequest,
    updatedLabel,
    uploading
  };
}

function createDraftFromProfile(profile) {
  return {
    characterName: profile?.characterName || "",
    classRole: profile?.classRole || "",
    level: profile?.level ?? "",
    stats: profile?.stats || {},
    bio: profile?.bio || "",
    avatarUrl: profile?.avatarUrl || ""
  };
}

function mergeAllowedPreset(current, preset, allowedFields) {
  const merged = mergePresets([preset], true, false)[0];
  if (!merged) return current;
  const next = { ...current };
  for (const field of allowedFields || []) {
    if (Object.hasOwn(merged, field)) {
      next[field] = merged[field];
    }
  }
  return next;
}
