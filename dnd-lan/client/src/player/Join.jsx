import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, storage } from "../api.js";
import VintageShell from "../components/vintage/VintageShell.jsx";
import QRCodeCard from "../components/QRCodeCard.jsx";
import { formatError } from "../lib/formatError.js";
import { ERROR_CODES } from "../lib/errorCodes.js";
import { resolveJoinUrl } from "../lib/joinUrl.js";
import { useReadOnly } from "../hooks/useReadOnly.js";
import { t } from "../i18n/index.js";

export default function Join() {
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const readOnly = useReadOnly();

  useEffect(() => {
    api.serverInfo().then(setInfo).catch((e) => setErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED)));
    api.me()
      .then(() => nav("/app", { replace: true }))
      .catch(() => {
        if (storage.getJoinRequestId()) {
          nav("/waiting", { replace: true });
        }
      });
  }, [nav]);

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    setErr("");
    if (readOnly) {
      setErr(formatError(ERROR_CODES.READ_ONLY));
      return;
    }
    setSubmitting(true);
    try {
      const r = await api.joinRequest(displayName, joinCode);
      storage.setJoinRequestId(r.joinRequestId);
      nav("/waiting", { replace: true });
    } catch (e2) {
      setErr(formatError(e2));
      setSubmitting(false);
    }
  }

  const joinUrl = resolveJoinUrl(info);

  return (
    <VintageShell layout="spread">
      <div className="container">
        <div className="spread-grid">
          <div className="spread-col">
            <div className="card taped panel scrap-card paper-stack">
              <div className="u-title-xl">{t("join.title")}</div>
              <div className="progress-steps" aria-label={t("join.progressAria")}>
                <div className="progress-step active" aria-current="step">
                  <span className="progress-dot" aria-hidden="true" />
                  <span className="progress-label">{t("join.progressStepRequest")}</span>
                </div>
                <span className="progress-line" aria-hidden="true" />
                <div className="progress-step">
                  <span className="progress-dot" aria-hidden="true" />
                  <span className="progress-label">{t("join.progressStepApprove")}</span>
                </div>
                <span className="progress-line" aria-hidden="true" />
                <div className="progress-step">
                  <span className="progress-dot" aria-hidden="true" />
                  <span className="progress-label">{t("join.progressStepEnter")}</span>
                </div>
              </div>
              <div className="small progress-hint">
                {t("join.progressHint")}
              </div>
              <div className="paper-note u-mt-8">
                {info?.party?.name ? t("join.partyName", { name: info.party.name }) : t("common.loading")}
              </div>
              <hr />
              <form onSubmit={submit} className="list">
                <div className="kv">
                  <div>{t("join.playerNameLabel")}</div>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t("join.playerNamePlaceholder")}
                    aria-label={t("join.playerNameLabel")}
                    className="u-w-full"
                  />
                </div>
                {info?.party?.joinCodeEnabled && (
                  <div className="kv">
                    <div>{t("join.joinCodeLabel")}</div>
                    <input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder={t("join.joinCodePlaceholder")}
                      aria-label={t("join.joinCodeLabel")}
                      className="u-w-full"
                    />
                  </div>
                )}
                {readOnly ? <div className="badge warn">{t("join.readOnly")}</div> : null}
                {err && <div className="badge off">{t("common.error")}: {err}</div>}
                <button className="btn" type="submit" disabled={readOnly || submitting}>{t("join.submit")}</button>
              </form>
            </div>
          </div>

          <div className="spread-col">
            <div className="card taped scrap-card">
              <div className="u-fw-800">{t("join.guideTitle")}</div>
              <div className="small">{t("join.guideSubtitle")}</div>
              <hr />
              <div className="list">
                <div className="item">
                  <div className="kv">
                    <div className="u-fw-700">{t("join.step1Title")}</div>
                    <div className="small">{joinUrl || t("join.step1Hint")}</div>
                  </div>
                </div>
                <div className="item">
                  <div className="kv">
                    <div className="u-fw-700">{t("join.step2Title")}</div>
                    <div className="small">{t("join.step2Hint")}</div>
                  </div>
                </div>
                <div className="item">
                  <div className="kv">
                    <div className="u-fw-700">{t("join.step3Title")}</div>
                    <div className="small">{t("join.step3Hint")}</div>
                  </div>
                </div>
              </div>
              <div className="paper-note u-mt-10">
                <div className="title">{t("join.tipTitle")}</div>
                <div className="small">{t("join.tipBody")}</div>
              </div>
            </div>

            <QRCodeCard url={joinUrl} className="scrap-card paper-stack" />
          </div>
        </div>
      </div>
    </VintageShell>
  );
}
