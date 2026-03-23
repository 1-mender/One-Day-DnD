import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api.js";
import { useToast } from "../../foundation/providers/index.js";
import { useSocket } from "../../context/SocketContext.jsx";
import { useReadOnly } from "../../hooks/useReadOnly.js";
import { formatError } from "../../lib/formatError.js";
import {
  EMPTY_DM_PROFILE_FORM,
  hasAnyData,
  hasUnsavedChanges,
  normalizeRequestChanges
} from "./playerProfileAdminDomain.js";

export function useDmPlayerProfileController() {
  const { id } = useParams();
  const playerId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { socket } = useSocket();
  const readOnly = useReadOnly();

  const [player, setPlayer] = useState(null);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(EMPTY_DM_PROFILE_FORM);
  const [notCreated, setNotCreated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("profile");
  const [requests, setRequests] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqStatus, setReqStatus] = useState("pending");
  const [requestNotes, setRequestNotes] = useState({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [requestsRef] = useAutoAnimate({ duration: 200 });
  const [profilePresets, setProfilePresets] = useState([]);

  const applyProfile = useCallback((nextProfile) => {
    setProfile(nextProfile);
    setForm({
      characterName: nextProfile?.characterName || "",
      classRole: nextProfile?.classRole || "",
      level: nextProfile?.level ?? "",
      stats: nextProfile?.stats || {},
      bio: nextProfile?.bio || "",
      avatarUrl: nextProfile?.avatarUrl || "",
      editableFields: nextProfile?.editableFields || [],
      allowRequests: !!nextProfile?.allowRequests
    });
  }, []);

  const load = useCallback(async () => {
    if (!playerId) return;
    setErr("");
    setLoading(true);
    try {
      const [playersResponse, profileResponse] = await Promise.all([
        api.dmPlayers(),
        api.playerProfile(playerId)
      ]);
      const foundPlayer = (playersResponse.items || []).find((item) => item.id === playerId);
      setPlayer(foundPlayer || null);
      if (profileResponse.notCreated) {
        setProfile(null);
        setNotCreated(true);
        setForm(EMPTY_DM_PROFILE_FORM);
      } else {
        setNotCreated(false);
        applyProfile(profileResponse.profile);
      }
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setLoading(false);
    }
  }, [applyProfile, playerId]);

  const loadRequests = useCallback(async () => {
    if (!playerId) return;
    setReqLoading(true);
    try {
      const response = await api.dmProfileRequests("");
      setRequests(response.items || []);
    } catch {
      setRequests([]);
    } finally {
      setReqLoading(false);
    }
  }, [playerId]);

  const loadPresets = useCallback(async () => {
    try {
      const response = await api.dmProfilePresets();
      setProfilePresets(Array.isArray(response?.presets) ? response.presets : []);
    } catch {
      setProfilePresets([]);
    }
  }, []);

  const loadRequestsRef = useRef(loadRequests);
  useEffect(() => {
    loadRequestsRef.current = loadRequests;
  }, [loadRequests]);

  const loadPresetsRef = useRef(loadPresets);
  useEffect(() => {
    loadPresetsRef.current = loadPresets;
  }, [loadPresets]);

  useEffect(() => {
    if (!socket) return () => {};
    const onCreated = () => loadRequestsRef.current?.().catch(() => {});
    const onUpdated = () => loadRequestsRef.current?.().catch(() => {});
    const onSettings = () => loadPresetsRef.current?.().catch(() => {});
    socket.on("profile:requestCreated", onCreated);
    socket.on("profile:requestsUpdated", onUpdated);
    socket.on("settings:updated", onSettings);
    return () => {
      socket.off("profile:requestCreated", onCreated);
      socket.off("profile:requestsUpdated", onUpdated);
      socket.off("settings:updated", onSettings);
    };
  }, [socket]);

  useEffect(() => {
    load().catch(() => {});
    loadRequests().catch(() => {});
    loadPresets().catch(() => {});
  }, [load, loadPresets, loadRequests]);

  const save = useCallback(async () => {
    if (readOnly || !playerId) return;
    setErr("");
    try {
      const payload = {
        ...form,
        level: form.level === "" ? null : Number(form.level),
        stats: form.stats || {},
        editableFields: form.editableFields || [],
        allowRequests: !!form.allowRequests
      };
      const response = await api.dmUpdatePlayerProfile(playerId, payload);
      applyProfile(response.profile);
      setNotCreated(false);
      toast.success("Профиль сохранён");
    } catch (e) {
      const message = formatError(e);
      setErr(message);
      toast.error(message);
    }
  }, [applyProfile, form, playerId, readOnly, toast]);

  const applyPreset = useCallback((preset) => {
    setForm((prev) => ({
      ...prev,
      stats: { ...preset.stats, race: prev?.stats?.race ?? preset?.stats?.race }
    }));
  }, []);

  const applyProfilePreset = useCallback((preset) => {
    const data = preset?.data || {};
    const nextLevel = data.level === "" || data.level == null ? "" : Number(data.level);
    setForm((prev) => ({
      ...prev,
      ...data,
      level: Number.isFinite(nextLevel) ? nextLevel : prev.level,
      stats: data.stats
        ? { ...(data.stats || {}), race: prev?.stats?.race ?? data?.stats?.race }
        : prev.stats
    }));
  }, []);

  const applyFromRequest = useCallback((requestItem) => {
    const patch = normalizeRequestChanges(requestItem?.proposedChanges);
    if (!Object.keys(patch).length) return;
    setForm((prev) => ({ ...prev, ...patch }));
    setTab("profile");
    toast.info("Изменения перенесены в форму");
  }, [toast]);

  const handleAvatarFileChange = useCallback(async (event) => {
    if (readOnly) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const response = await api.uploadAsset(file);
      setForm((current) => ({ ...current, avatarUrl: response.url || "" }));
      toast.success("Аватар загружен");
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [readOnly, toast]);

  const resetForm = useCallback(() => {
    if (readOnly) return;
    if (profile) applyProfile(profile);
    else setForm(EMPTY_DM_PROFILE_FORM);
  }, [applyProfile, profile, readOnly]);

  const toggleEditable = useCallback((key) => {
    if (readOnly) return;
    setForm((prev) => {
      const next = new Set(prev.editableFields || []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, editableFields: Array.from(next) };
    });
  }, [readOnly]);

  const approve = useCallback(async (requestId) => {
    if (readOnly) return;
    try {
      const note = requestNotes[requestId] || "";
      await api.dmApproveProfileRequest(requestId, note);
      await load();
      await loadRequests();
      setRequestNotes((prev) => ({ ...prev, [requestId]: "" }));
      toast.success("Запрос одобрен");
    } catch (e) {
      toast.error(formatError(e));
    }
  }, [load, loadRequests, readOnly, requestNotes, toast]);

  const reject = useCallback(async (requestId) => {
    if (readOnly) return;
    try {
      const note = requestNotes[requestId] || "";
      await api.dmRejectProfileRequest(requestId, note);
      await loadRequests();
      setRequestNotes((prev) => ({ ...prev, [requestId]: "" }));
      toast.warn("Запрос отклонён");
    } catch (e) {
      toast.error(formatError(e));
    }
  }, [loadRequests, readOnly, requestNotes, toast]);

  const playerRequestsAll = requests.filter((requestItem) => requestItem.playerId === playerId);
  const playerRequests = reqStatus === "all"
    ? playerRequestsAll
    : playerRequestsAll.filter((requestItem) => requestItem.status === reqStatus);
  const showRequestsTab = form.allowRequests || playerRequestsAll.length > 0;
  const updatedLabel = profile?.updatedAt ? new Date(profile.updatedAt).toLocaleString() : "-";
  const dirty = hasUnsavedChanges(form, profile);
  const canSave = !readOnly && (dirty || (notCreated && hasAnyData(form)));

  return {
    applyFromRequest,
    applyPreset,
    applyProfilePreset,
    approve,
    canSave,
    dirty,
    err,
    fileInputRef,
    form,
    goBack: () => navigate("/dm/app/players"),
    handleAvatarFileChange,
    load,
    loadRequests,
    loading,
    notCreated,
    player,
    playerId,
    playerRequests,
    playerRequestsAll,
    profile,
    profilePresets,
    readOnly,
    reject,
    reqLoading,
    reqStatus,
    requestNotes,
    requestsRef,
    resetForm,
    save,
    setForm,
    setReqStatus,
    setRequestNotes,
    setTab,
    showRequestsTab,
    tab,
    toggleEditable,
    updatedLabel,
    uploading
  };
}
