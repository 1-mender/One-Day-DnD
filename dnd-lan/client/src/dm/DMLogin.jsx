import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api.js";
import VintageShell from "../components/vintage/VintageShell.jsx";
import { formatError } from "../lib/formatError.js";
import { ERROR_CODES } from "../lib/errorCodes.js";
import { t } from "../i18n/index.js";

export default function DMLogin() {
  const nav = useNavigate();
  const [info, setInfo] = useState(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [netErr, setNetErr] = useState("");

  useEffect(() => {
    api.serverInfo().then((r) => {
      setNetErr("");
      setInfo(r);
      if (!r.hasDm) nav("/dm/setup", { replace: true });
    }).catch((e) => setNetErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED)));
  }, [nav]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
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
          <div className="u-title-xl">{t("dmLogin.title")}</div>
          <div className="small">{t("dmLogin.subtitle")}</div>
          <hr />
          <form className="list" onSubmit={submit}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("dmLogin.usernamePlaceholder")}
              aria-label={t("dmLogin.usernamePlaceholder")}
              className="u-w-full"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("dmLogin.passwordPlaceholder")}
              aria-label={t("dmLogin.passwordPlaceholder")}
              type="password"
              className="u-w-full"
            />
            {err && <div className="badge off">{t("common.error")}: {err}</div>}
            {netErr && <div className="badge off">{t("common.network")}: {netErr}</div>}
            <button className="btn" type="submit">{t("dmLogin.submit")}</button>
            {!info?.hasDm && <div className="small">{t("dmLogin.noDm")} <Link to="/dm/setup">{t("dmLogin.setupLink")}</Link></div>}
          </form>
        </div>
      </div>
    </VintageShell>
  );
}
