import { useCallback } from "react";
import { api } from "../../../api.js";
import { ERROR_CODES } from "../../../lib/errorCodes.js";
import { formatError } from "../../../lib/formatError.js";

export function useDmBackupActions({ readOnly, reportMessage, reportError }) {
  const exportZip = useCallback(async () => {
    reportMessage("");
    reportError("");
    try {
      const blob = await api.exportZip();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `backup_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      reportMessage("Экспорт готов.");
    } catch (e) {
      reportError(formatError(e, ERROR_CODES.EXPORT_FAILED));
    }
  }, [reportError, reportMessage]);

  const importZip = useCallback(async (event) => {
    if (readOnly) return;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    reportMessage("");
    reportError("");
    try {
      await api.importZip(file);
      reportMessage("Импорт выполнен.");
    } catch (e) {
      reportError(formatError(e, ERROR_CODES.IMPORT_FAILED));
    }
  }, [readOnly, reportError, reportMessage]);

  return {
    exportZip,
    importZip
  };
}
