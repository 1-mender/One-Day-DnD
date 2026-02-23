import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, storage } from "../api.js";
import VintageShell from "../components/vintage/VintageShell.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { t } from "../i18n/index.js";

export default function Waiting() {
  const nav = useNavigate();
  const [status, setStatus] = useState("waiting"); // waiting/approved/rejected
  const [msg, setMsg] = useState("");
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return () => {};
    const onApproved = async (p) => {
      try {
        await api.playerSessionStart(p?.playerToken);
        storage.clearJoinRequestId();
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

  return (
    <VintageShell>
      <div className="container">
        <div className="card taped panel">
          <div className="u-title-lg">{t("waiting.title")}</div>
          <div className="small u-mt-8">
            {t("waiting.subtitle")}
          </div>
          <hr />
          {status === "waiting" && <div className="badge warn">{t("waiting.status")}</div>}
          {status === "rejected" && <div className="badge off">{msg}</div>}
          <button className="btn secondary u-mt-12" onClick={() => nav("/", { replace: true })}>
            {t("common.back")}
          </button>
        </div>
      </div>
    </VintageShell>
  );
}
