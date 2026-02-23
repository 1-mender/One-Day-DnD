import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, storage } from "../api.js";
import VintageShell from "../components/vintage/VintageShell.jsx";
import QRCodeCard from "../components/QRCodeCard.jsx";
import { formatError } from "../lib/formatError.js";
import { ERROR_CODES } from "../lib/errorCodes.js";
import { resolveJoinUrl } from "../lib/joinUrl.js";
import { useReadOnly } from "../hooks/useReadOnly.js";

export default function Join() {
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const readOnly = useReadOnly();

  useEffect(() => {
    api.serverInfo().then(setInfo).catch((e) => setErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED)));
    api.me()
      .then(() => nav("/app", { replace: true }))
      .catch(() => {});
  }, [nav]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (readOnly) {
      setErr(formatError(ERROR_CODES.READ_ONLY));
      return;
    }
    try {
      const r = await api.joinRequest(displayName, joinCode);
      storage.setJoinRequestId(r.joinRequestId);
      nav("/waiting", { replace: true });
    } catch (e2) {
      setErr(formatError(e2));
    }
  }

  const joinUrl = resolveJoinUrl(info);

  return (
    <VintageShell layout="spread">
      <div className="container">
        <div className="spread-grid">
          <div className="spread-col">
            <div className="card taped panel scrap-card paper-stack">
              <div className="u-title-xl">Подключиться к партии</div>
              <div className="paper-note u-mt-8">
                {info?.party?.name ? `Партия: ${info.party.name}` : "Загрузка…"}
              </div>
              <hr />
              <form onSubmit={submit} className="list">
                <div className="kv">
                  <div>Имя игрока/персонажа *</div>
                  <input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} placeholder="Напр. Aria / Bob" className="u-w-full" />
                </div>
                {info?.party?.joinCodeEnabled && (
                  <div className="kv">
                    <div>Код партии</div>
                    <input value={joinCode} onChange={(e)=>setJoinCode(e.target.value)} placeholder="Если включён DM" className="u-w-full" />
                  </div>
                )}
                {readOnly ? <div className="badge warn">Режим только чтения: изменения отключены</div> : null}
                {err && <div className="badge off">Ошибка: {err}</div>}
                <button className="btn" type="submit" disabled={readOnly}>Отправить заявку</button>
              </form>
            </div>
          </div>

          <div className="spread-col">
            <div className="card taped scrap-card">
              <div className="u-fw-800">Как подключиться</div>
              <div className="small">Короткая памятка для игроков</div>
              <hr />
              <div className="list">
                <div className="item">
                  <div className="kv">
                    <div className="u-fw-700">1. Откройте адрес сервера</div>
                    <div className="small">{joinUrl || "Адрес выдаст мастер"}</div>
                  </div>
                </div>
                <div className="item">
                  <div className="kv">
                    <div className="u-fw-700">2. Введите имя</div>
                    <div className="small">Можно имя игрока или персонажа</div>
                  </div>
                </div>
                <div className="item">
                  <div className="kv">
                    <div className="u-fw-700">3. Код партии (если нужен)</div>
                    <div className="small">Запросите у мастера, если включено</div>
                  </div>
                </div>
              </div>
              <div className="paper-note u-mt-10">
                <div className="title">Совет</div>
                <div className="small">Если не открывается — проверьте Wi‑Fi сеть и повторите.</div>
              </div>
            </div>

            <QRCodeCard url={joinUrl} className="scrap-card paper-stack" />
          </div>
        </div>
      </div>
    </VintageShell>
  );
}

