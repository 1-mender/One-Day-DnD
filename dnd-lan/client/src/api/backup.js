import { ERROR_CODES, requestBlob, uploadForm } from "./client.js";

export const backupApi = {
  exportZip: async () => requestBlob("/api/backup/export", ERROR_CODES.EXPORT_FAILED),
  importZip: async (file) => {
    const formData = new FormData();
    formData.append("zip", file);
    return uploadForm("/api/backup/import", formData, ERROR_CODES.IMPORT_FAILED);
  }
};
