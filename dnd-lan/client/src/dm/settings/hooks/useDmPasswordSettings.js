import { useCallback, useState } from "react";
import { api } from "../../../api.js";
import { formatError } from "../../../lib/formatError.js";

export function useDmPasswordSettings({ readOnly, reportMessage, reportError }) {
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [showPass, setShowPass] = useState(false);

  const changePassword = useCallback(async () => {
    if (readOnly) return;
    reportMessage("");
    reportError("");
    const pass = String(newPass || "");
    if (!pass) {
      reportError("Введите новый пароль.");
      return;
    }
    if (pass !== String(newPass2 || "")) {
      reportError("Пароли не совпадают.");
      return;
    }
    try {
      await api.dmChangePassword(pass);
      reportMessage("Пароль изменён.");
      setNewPass("");
      setNewPass2("");
      setShowPass(false);
    } catch (e) {
      reportError(formatError(e));
    }
  }, [newPass, newPass2, readOnly, reportError, reportMessage]);

  return {
    newPass,
    setNewPass,
    newPass2,
    setNewPass2,
    showPass,
    setShowPass,
    changePassword
  };
}
