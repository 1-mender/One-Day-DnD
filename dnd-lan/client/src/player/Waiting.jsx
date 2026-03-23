import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, storage } from "../api.js";
import VintageShell from "../components/vintage/VintageShell.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { t } from "../i18n/index.js";

export default function Waiting() {
  const nav = useNavigate();
  const [status, setStatus] = useState("waiting"); // waiting/approved/rejected
  const [msg, setMsg] = useState("");
  const [checking, setChecking] = useState(false);
  const [netIssue, setNetIssue] = useState("");
  const { socket } = useSocket();

  const checkSession = useCallback(async () => {
    if (status !== "waiting") return;
    setChecking(true);
    setNetIssue("");
    try {
      await api.me();
      storage.clearJoinRequestId();
      nav("/app", { replace: true });
    } catch (e) {
      const code = String(e?.message || "");
      if (code !== "not_authenticated") {
        setNetIssue(t("waiting.networkIssue"));
      }
    } finally {
      setChecking(false);
    }
  }, [nav, status]);

  useEffect(() => {
    if (!socket) return () => {};
    const onApproved = async (p) => {
      try {
        await api.playerSessionStart(p?.playerToken);
        storage.clearJoinRequestId();
        setNetIssue("");
        setStatus("approved");
        nav("/app", { replace: true });
      } catch {
        setStatus("rejected");
        setMsg(t("waiting.sessionOpenFailed"));
      }
    };
    const onRejected = (p) => {
      setStatus("rejected");
      storage.clearJoinRequestId();
      setMsg(p?.banned ? t("waiting.rejectedBanned") : t("waiting.rejected"));
    };
    socket.on("player:approved", onApproved);
    socket.on("player:rejected", onRejected);
    return () => {
      socket.off("player:approved", onApproved);
      socket.off("player:rejected", onRejected);
    };
  }, [nav, socket]);

  useEffect(() => {
    checkSession().catch(() => {});
  }, [checkSession]);

  useEffect(() => {
    if (status !== "waiting") return () => {};
    const id = setInterval(() => {
      checkSession().catch(() => {});
    }, 8000);
    return () => clearInterval(id);
  }, [checkSession, status]);

  const leaveWaiting = useCallback(() => {
    storage.clearJoinRequestId();
    nav("/", { replace: true });
  }, [nav]);

  return (
    <VintageShell>
      <div className="container">
        <div className="card taped panel">
          <div className="u-title-lg">{t("waiting.title")}</div>
          <div className="progress-steps" aria-label={t("waiting.progressAria")}>
            <div className="progress-step complete">
              <span className="progress-dot" aria-hidden="true" />
              <span className="progress-label">{t("join.progressStepRequest")}</span>
            </div>
            <span className="progress-line" aria-hidden="true" />
            <div className="progress-step active" aria-current="step">
              <span className="progress-dot" aria-hidden="true" />
              <span className="progress-label">{t("join.progressStepApprove")}</span>
            </div>
            <span className="progress-line" aria-hidden="true" />
            <div className="progress-step">
              <span className="progress-dot" aria-hidden="true" />
              <span className="progress-label">{t("join.progressStepEnter")}</span>
            </div>
          </div>
          <div className="small u-mt-8">
            {t("waiting.subtitle")}
          </div>
          <div className="small progress-hint">
            {t("waiting.progressHint")}
          </div>
          <hr />
          {status === "waiting" && <div className="badge warn">{t("waiting.status")}</div>}
          {status === "rejected" && <div className="badge off">{msg}</div>}
          {netIssue ? <div className="badge secondary u-mt-8">{netIssue}</div> : null}
          <button className="btn secondary u-mt-12" onClick={() => checkSession().catch(() => {})} disabled={checking || status !== "waiting"}>
            {checking ? t("waiting.checking") : t("waiting.checkStatus")}
          </button>
          <button className="btn secondary u-mt-12" onClick={leaveWaiting}>
            {t("common.back")}
          </button>
        </div>
      </div>
    </VintageShell>
  );
}
