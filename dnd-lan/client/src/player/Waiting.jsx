import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { storage } from "../api.js";
import VintageShell from "../components/vintage/VintageShell.jsx";
import { useSocket } from "../context/SocketContext.jsx";

export default function Waiting() {
  const nav = useNavigate();
  const [status, setStatus] = useState("waiting"); // waiting/approved/rejected
  const [msg, setMsg] = useState("");
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return () => {};
    const onApproved = (p) => {
      storage.setPlayerToken(p.playerToken);
      storage.clearJoinRequestId();
      setStatus("approved");
      nav("/app", { replace: true });
    };
    const onRejected = (p) => {
      setStatus("rejected");
      storage.clearJoinRequestId();
      setMsg(p?.banned ? "Заявка отклонена. Вы заблокированы." : "Заявка отклонена.");
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
          <div style={{ fontWeight: 800, fontSize: 20 }}>Ожидание подтверждения</div>
          <div className="small" style={{ marginTop: 8 }}>
            DM должен принять вашу заявку в лобби.
          </div>
          <hr />
          {status === "waiting" && <div className="badge warn">Ожидание…</div>}
          {status === "rejected" && <div className="badge off">{msg}</div>}
          <button className="btn secondary" onClick={() => nav("/", { replace: true })} style={{ marginTop: 12 }}>
            Назад
          </button>
        </div>
      </div>
    </VintageShell>
  );
}
