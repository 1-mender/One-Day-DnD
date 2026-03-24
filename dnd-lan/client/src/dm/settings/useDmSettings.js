import { useCallback, useEffect, useState } from "react";
import { api } from "../../api.js";
import { useSocket } from "../../context/SocketContext.jsx";
import { useReadOnly } from "../../hooks/useReadOnly.js";
import { ERROR_CODES } from "../../lib/errorCodes.js";
import { formatError } from "../../lib/formatError.js";
import { useDmProfilePresets } from "./hooks/useDmProfilePresets.js";
import { useDmTicketRules } from "./hooks/useDmTicketRules.js";

export function useDmSettings() {
  const [joinEnabled, setJoinEnabled] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [showJoin, setShowJoin] = useState(false);

  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [info, setInfo] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const { socket } = useSocket();
  const readOnly = useReadOnly();
  const { hydrateTicketRules, ...ticketRulesState } = useDmTicketRules({ readOnly });
  const { hydrateProfilePresets, ...profilePresetsState } = useDmProfilePresets({ readOnly });

  const load = useCallback(async () => {
    setErr("");
    try {
      const [jc, si, tr, presets] = await Promise.all([
        api.dmGetJoinCode(),
        api.serverInfo(),
        api.dmTicketsRules(),
        api.dmProfilePresets()
      ]);
      setJoinEnabled(!!jc.enabled);
      setJoinCode(jc.joinCode || "");
      setInfo(si);
      hydrateTicketRules(tr?.rules || null);
      hydrateProfilePresets(presets?.presets, presets?.access);
    } catch (e) {
      setErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED));
    }
  }, [hydrateProfilePresets, hydrateTicketRules]);

  useEffect(() => {
    if (!socket) return () => {};
    load().catch((e) => setErr(formatError(e)));
    const onUpdated = () => load().catch(() => {});
    socket.on("settings:updated", onUpdated);
    return () => {
      socket.off("settings:updated", onUpdated);
    };
  }, [load, socket]);

  const lanUrl = info?.urls?.[0] || (info?.ips?.[0] && info?.port ? `http://${info.ips[0]}:${info.port}` : "");

  async function saveJoinCode() {
    if (readOnly) return;
    setMsg("");
    setErr("");
    try {
      const nextCode = joinEnabled ? String(joinCode || "").trim() : "";
      await api.dmSetJoinCode(nextCode);
      setMsg("Код партии сохранён.");
      await load();
    } catch (e) {
      setErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED));
    }
  }

  async function changePassword() {
    if (readOnly) return;
    setMsg("");
    setErr("");
    const pass = String(newPass || "");
    if (!pass) {
      setErr("Введите новый пароль.");
      return;
    }
    if (pass !== String(newPass2 || "")) {
      setErr("Пароли не совпадают.");
      return;
    }
    try {
      await api.dmChangePassword(pass);
      setMsg("Пароль изменён.");
      setNewPass("");
      setNewPass2("");
      setShowPass(false);
    } catch (e) {
      setErr(formatError(e));
    }
  }

  async function exportZip() {
    setMsg("");
    setErr("");
    try {
      const blob = await api.exportZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg("Экспорт готов.");
    } catch (e) {
      setErr(formatError(e, ERROR_CODES.EXPORT_FAILED));
    }
  }

  async function importZip(e) {
    if (readOnly) return;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMsg("");
    setErr("");
    try {
      await api.importZip(file);
      setMsg("Импорт выполнен.");
    } catch (err2) {
      setErr(formatError(err2, ERROR_CODES.IMPORT_FAILED));
    }
  }

  return {
    joinEnabled,
    setJoinEnabled,
    joinCode,
    setJoinCode,
    showJoin,
    setShowJoin,
    newPass,
    setNewPass,
    newPass2,
    setNewPass2,
    showPass,
    setShowPass,
    msg,
    err,
    readOnly,
    lanUrl,
    saveJoinCode,
    changePassword,
    exportZip,
    importZip,
    ...ticketRulesState,
    ...profilePresetsState
  };
}
