import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import VintageShell from "../components/vintage/VintageShell.jsx";
import { formatError } from "../lib/formatError.js";
import { ERROR_CODES } from "../lib/errorCodes.js";
import { t } from "../i18n/index.js";

export default function DMSetup() {
  const nav = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [setupSecret, setSetupSecret] = useState("");
  const [err, setErr] = useState("");
  const [netErr, setNetErr] = useState("");

  useEffect(() => {
    api.serverInfo().then((r) => {
      setNetErr("");
      if (r.hasDm) nav("/dm", { replace: true });
    }).catch((e) => setNetErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED)));
  }, [nav]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.dmSetup(username, password, setupSecret);
      await api.dmLogin(username, password);
      nav("/dm/app/dashboard", { replace: true });
    } catch (e2) {
      setErr(formatError(e2));
    }
  }

  return (
    <VintageShell>
      <div className="container">
        <div className="card taped panel">
          <div className="u-title-xl">{t("dmSetup.title")}</div>
          <div className="small">{t("dmSetup.subtitle")}</div>
          <hr />
          <form className="list" onSubmit={submit}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("dmSetup.usernamePlaceholder")}
              aria-label={t("dmSetup.usernamePlaceholder")}
              className="u-w-full"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("dmSetup.passwordPlaceholder")}
              aria-label={t("dmSetup.passwordPlaceholder")}
              type="password"
              className="u-w-full"
            />
            <input
              value={setupSecret}
              onChange={(e) => setSetupSecret(e.target.value)}
              placeholder={t("dmSetup.setupSecretPlaceholder")}
              aria-label={t("dmSetup.setupSecretPlaceholder")}
              className="u-w-full"
            />
            {err && <div className="badge off">{t("common.error")}: {err}</div>}
            {netErr && <div className="badge off">{t("common.network")}: {netErr}</div>}
            <button className="btn" type="submit">{t("dmSetup.submit")}</button>
          </form>
        </div>
      </div>
    </VintageShell>
  );
}
