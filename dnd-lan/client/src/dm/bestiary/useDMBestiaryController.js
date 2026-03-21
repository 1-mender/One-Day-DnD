import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api.js";
import { useSocket } from "../../context/SocketContext.jsx";
import { useReadOnly } from "../../hooks/useReadOnly.js";
import { useQueryState } from "../../hooks/useQueryState.js";
import { formatError } from "../../lib/formatError.js";
import { EMPTY_BESTIARY_FORM, filterBestiary } from "./dmBestiaryDomain.js";

export function useDMBestiaryController() {
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(EMPTY_BESTIARY_FORM);
  const [images, setImages] = useState([]);
  const [err, setErr] = useState("");
  const [q, setQ] = useQueryState("q", "");
  const [vis, setVis] = useQueryState("vis", "");
  const [selectedIdParam, setSelectedIdParam] = useQueryState("id", "");
  const [loadingMore, setLoadingMore] = useState(false);
  const [portErr, setPortErr] = useState("");
  const [portMsg, setPortMsg] = useState("");
  const [portBusy, setPortBusy] = useState(false);
  const [portMode, setPortMode] = useState("merge");
  const [portMatch, setPortMatch] = useState("name");
  const [portOnExisting, setPortOnExisting] = useState("update");
  const [portImagesMeta, setPortImagesMeta] = useState(false);
  const [portPendingFile, setPortPendingFile] = useState(null);
  const [portPlan, setPortPlan] = useState(null);
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
  const fileRef = useRef(null);
  const importRef = useRef(null);
  const { socket } = useSocket();
  const readOnly = useReadOnly();

  const attachImages = useCallback(async (list) => {
    const ids = (list || []).map((monster) => monster.id).filter(Boolean);
    if (!ids.length) return;
    try {
      const response = await api.bestiaryImagesBatch(ids, { limitPer: 1 });
      const map = new Map();
      if (Array.isArray(response.items)) {
        for (const item of response.items) map.set(item.monsterId || item.id, item.images || []);
      } else if (response.items && typeof response.items === "object") {
        for (const [key, value] of Object.entries(response.items)) map.set(Number(key), value || []);
      }
      if (!map.size) return;
      setItems((prev) => prev.map((monster) => (map.has(monster.id) ? { ...monster, images: map.get(monster.id) } : monster)));
    } catch {
      // ignore thumbnail errors
    }
  }, []);

  const load = useCallback(async () => {
    setErr("");
    try {
      const response = await api.bestiaryPage({ limit: 200 });
      setEnabled(!!response.enabled);
      setItems(response.items || []);
      setNextCursor(response.nextCursor || null);
      await attachImages(response.items || []);
    } catch (e) {
      setErr(formatError(e));
    }
  }, [attachImages]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    setErr("");
    try {
      const response = await api.bestiaryPage({ limit: 200, cursor: nextCursor });
      setEnabled(!!response.enabled);
      setItems((prev) => [...prev, ...(response.items || [])]);
      setNextCursor(response.nextCursor || null);
      await attachImages(response.items || []);
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setLoadingMore(false);
    }
  }, [attachImages, nextCursor]);

  useEffect(() => {
    if (!socket) return () => {};
    load().catch(() => {});
    const onUpdated = () => load().catch(() => {});
    const onSettings = () => load().catch(() => {});
    socket.on("bestiary:updated", onUpdated);
    socket.on("settings:updated", onSettings);
    return () => {
      socket.off("bestiary:updated", onUpdated);
      socket.off("settings:updated", onSettings);
    };
  }, [load, socket]);

  const selectedId = Number(selectedIdParam || 0);
  const selected = useMemo(
    () => items.find((monster) => monster.id === selectedId) || null,
    [items, selectedId]
  );

  const filtered = useMemo(
    () => filterBestiary(items, q, vis),
    [items, q, vis]
  );

  const loadImages = useCallback(async (monsterId) => {
    try {
      const response = await api.dmBestiaryImages(monsterId);
      setImages(response.items || []);
    } catch (e) {
      setImages([]);
      setErr(formatError(e));
    }
  }, []);

  const selectMonster = useCallback((id) => {
    if (!id) setSelectedIdParam("");
    else setSelectedIdParam(String(id));
  }, [setSelectedIdParam]);

  const startNew = useCallback(() => {
    if (readOnly) return;
    setErr("");
    setEdit(null);
    setForm(EMPTY_BESTIARY_FORM);
    setImages([]);
    setOpen(true);
  }, [readOnly]);

  const startEdit = useCallback((monster) => {
    setErr("");
    setEdit(monster);
    const abilitiesText = Array.isArray(monster.abilities)
      ? monster.abilities.join("\n")
      : (typeof monster.abilities === "string" ? monster.abilities : "");
    setForm({ ...monster, abilitiesText });
    setOpen(true);
    loadImages(monster.id).catch(() => {});
  }, [loadImages]);

  const save = useCallback(async () => {
    if (readOnly) return;
    setErr("");
    const payload = {
      ...form,
      abilities: (form.abilitiesText || "")
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean)
    };
    delete payload.abilitiesText;
    try {
      if (edit) await api.dmBestiaryUpdate(edit.id, payload);
      else await api.dmBestiaryCreate(payload);
      setOpen(false);
      await load();
    } catch (e) {
      setErr(formatError(e));
    }
  }, [edit, form, load, readOnly]);

  const del = useCallback(async (id) => {
    setErr("");
    try {
      await api.dmBestiaryDelete(id);
      await load();
    } catch (e) {
      setErr(formatError(e));
    }
  }, [load]);

  const onPickFile = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file || !edit) return;
    setErr("");
    try {
      await api.dmBestiaryUploadImage(edit.id, file);
      await loadImages(edit.id);
    } catch (e) {
      setErr(formatError(e));
    } finally {
      event.target.value = "";
    }
  }, [edit, loadImages]);

  const delImage = useCallback(async (imageId) => {
    if (readOnly || !edit) return;
    setErr("");
    try {
      await api.dmBestiaryDeleteImage(imageId);
      await loadImages(edit.id);
    } catch (e) {
      setErr(formatError(e));
    }
  }, [edit, loadImages, readOnly]);

  const toggleEnabled = useCallback(async () => {
    if (readOnly) return;
    setErr("");
    try {
      await api.dmBestiaryToggle(!enabled);
      await load();
    } catch (e) {
      setErr(formatError(e));
    }
  }, [enabled, load, readOnly]);

  const toggleMonsterHidden = useCallback(async (monster) => {
    if (readOnly || !monster) return;
    setErr("");
    try {
      await api.dmBestiaryUpdate(monster.id, { is_hidden: !monster.is_hidden });
      await load();
    } catch (e) {
      setErr(formatError(e));
    }
  }, [load, readOnly]);

  const doExport = useCallback(async () => {
    setPortErr("");
    setPortMsg("");
    setPortBusy(true);
    try {
      const blob = await api.dmBestiaryExportJson(true);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bestiary_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setPortMsg("Экспорт JSON готов.");
    } catch (e) {
      setPortErr(formatError(e));
    } finally {
      setPortBusy(false);
    }
  }, []);

  const runDryRun = useCallback(async (file) => {
    if (readOnly) return;
    setPortErr("");
    setPortMsg("");
    setPortBusy(true);
    try {
      const response = await api.dmBestiaryImportJson(file, {
        mode: portMode,
        match: portMatch,
        onExisting: portOnExisting,
        imagesMeta: portImagesMeta,
        dryRun: true
      });
      setPortPlan(response);
      setPortMsg("Проверка готова: изучите план и нажмите «Применить».");
    } catch (e) {
      setPortPlan(null);
      setPortErr(formatError(e));
    } finally {
      setPortBusy(false);
    }
  }, [portImagesMeta, portMatch, portMode, portOnExisting, readOnly]);

  const runImport = useCallback(async () => {
    if (!portPendingFile) return;
    setPortErr("");
    setPortMsg("");
    setPortBusy(true);
    try {
      const response = await api.dmBestiaryImportJson(portPendingFile, {
        mode: portMode,
        match: portMatch,
        onExisting: portOnExisting,
        imagesMeta: portImagesMeta,
        dryRun: false
      });
      setPortMsg(`Импорт применён: создано=${response.created}, обновлено=${response.updated}, пропущено=${response.skipped}`);
      setPortPlan(null);
      setPortPendingFile(null);
      setReplaceConfirmOpen(false);
      await load();
    } catch (e) {
      setPortErr(formatError(e));
    } finally {
      setPortBusy(false);
    }
  }, [load, portImagesMeta, portMatch, portMode, portOnExisting, portPendingFile]);

  const applyImport = useCallback(async () => {
    if (readOnly || !portPendingFile) return;
    if (portMode === "replace") {
      setReplaceConfirmOpen(true);
      return;
    }
    await runImport();
  }, [portMode, portPendingFile, readOnly, runImport]);

  const resetPlan = useCallback(() => {
    setPortPlan(null);
    setPortPendingFile(null);
    setPortMsg("");
    setPortErr("");
  }, []);

  const onPickImport = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPortPendingFile(file);
    await runDryRun(file);
  }, [runDryRun]);

  return {
    del,
    delImage,
    doExport,
    edit,
    enabled,
    err,
    fileRef,
    filtered,
    form,
    images,
    importRef,
    items,
    loadMore,
    loadingMore,
    nextCursor,
    onPickFile,
    onPickImport,
    open,
    portBusy,
    portErr,
    portImagesMeta,
    portMatch,
    portMode,
    portMsg,
    portOnExisting,
    portPendingFile,
    portPlan,
    q,
    readOnly,
    replaceConfirmOpen,
    resetPlan,
    runDryRun,
    runImport,
    save,
    selectMonster,
    selected,
    selectedId,
    setForm,
    setOpen,
    setPortImagesMeta,
    setPortMatch,
    setPortMode,
    setPortOnExisting,
    setReplaceConfirmOpen,
    setQ,
    setVis,
    startEdit,
    startNew,
    toggleEnabled,
    toggleMonsterHidden,
    vis,
    applyImport
  };
}
