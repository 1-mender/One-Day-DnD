import { useCallback, useEffect, useState } from "react";
import { api } from "../../api.js";
import { useSocket } from "../../context/SocketContext.jsx";
import { useReadOnly } from "../../hooks/useReadOnly.js";
import { ERROR_CODES } from "../../lib/errorCodes.js";
import { formatError } from "../../lib/formatError.js";
import { useDmBackupActions } from "./hooks/useDmBackupActions.js";
import { useDmJoinSettings } from "./hooks/useDmJoinSettings.js";
import { useDmPasswordSettings } from "./hooks/useDmPasswordSettings.js";
import { useDmProfilePresets } from "./hooks/useDmProfilePresets.js";
import { useDmTicketRules } from "./hooks/useDmTicketRules.js";

export function useDmSettings() {
  const [info, setInfo] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const { socket } = useSocket();
  const readOnly = useReadOnly();
  const { hydrateJoinSettings, ...joinSettingsState } = useDmJoinSettings();
  const passwordSettingsState = useDmPasswordSettings({
    readOnly,
    reportMessage: setMsg,
    reportError: setErr
  });
  const backupActionsState = useDmBackupActions({
    readOnly,
    reportMessage: setMsg,
    reportError: setErr
  });
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
      hydrateJoinSettings(jc);
      setInfo(si);
      hydrateTicketRules(tr?.rules || null);
      hydrateProfilePresets(presets?.presets, presets?.access);
    } catch (e) {
      setErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED));
    }
  }, [hydrateJoinSettings, hydrateProfilePresets, hydrateTicketRules]);

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

  const saveJoinCode = useCallback(async () => {
    if (readOnly) return;
    setMsg("");
    setErr("");
    try {
      const nextCode = joinSettingsState.joinEnabled ? String(joinSettingsState.joinCode || "").trim() : "";
      await api.dmSetJoinCode(nextCode);
      setMsg("Код партии сохранён.");
      await load();
    } catch (e) {
      setErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED));
    }
  }, [joinSettingsState.joinCode, joinSettingsState.joinEnabled, load, readOnly]);

  return {
    msg,
    err,
    readOnly,
    lanUrl,
    ...joinSettingsState,
    saveJoinCode,
    ...passwordSettingsState,
    ...backupActionsState,
    ...ticketRulesState,
    ...profilePresetsState
  };
}
