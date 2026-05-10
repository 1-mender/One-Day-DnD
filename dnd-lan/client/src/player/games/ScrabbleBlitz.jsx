import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArcadeOverlay from "./ArcadeOverlay.jsx";

function normalizeWord(word) {
  return String(word || "").trim().toUpperCase();
}

function canFormWordFromRack(normalizedWord, rack) {
  if (normalizedWord.length < 3) return false;
  const letters = rack.slice();
  for (const ch of normalizedWord) {
    const idx = letters.indexOf(ch);
    if (idx === -1) return false;
    letters.splice(idx, 1);
  }
  return true;
}

export default function ScrabbleBlitzGame({
  open,
  onClose,
  onStartSession,
  onMoveSession,
  onFinishSession,
  disabled,
  entryCost = 0,
  rewardRange = "—",
  mode,
  readOnly
}) {
  const timeLimit = Number(mode?.timeLimit || 60);
  const [sessionId, setSessionId] = useState("");
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionErr, setSessionErr] = useState("");
  const [rack, setRack] = useState([]);
  const [word, setWord] = useState("");
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [status, setStatus] = useState("playing");
  const [result, setResult] = useState(null);
  const [settling, setSettling] = useState(false);
  const [apiErr, setApiErr] = useState("");
  const endAtRef = useRef(0);

  const entryLabel = entryCost
    ? `${entryCost} ${entryCost === 1 ? "билет" : entryCost < 5 ? "билета" : "билетов"}`
    : "бесплатно";
  const modeLabel = mode?.label || "Классика";
  const modeKey = String(mode?.key || "normal");

  const normalizedWord = useMemo(() => normalizeWord(word), [word]);
  const isWordPlayable = useMemo(() => canFormWordFromRack(normalizedWord, rack), [normalizedWord, rack]);

  const applySnapshot = useCallback((snapshot) => {
    const state = snapshot?.state || {};
    setSessionId(String(snapshot?.sessionId || ""));
    setRack(Array.isArray(state.rack) ? state.rack.map((letter) => String(letter || "")) : []);
    setWord(String(state.word || ""));
    setTimeLeft(Math.max(0, Number(state.timeLeftMs || 0) / 1000));
    setStatus(String(state.status || "playing"));
    endAtRef.current = Date.now() + Math.max(0, Number(state.timeLeftMs || 0));
  }, []);

  const startSession = useCallback(async () => {
    setSessionBusy(true);
    setSessionErr("");
    try {
      if (!onStartSession) throw new Error("session_api_unavailable");
      const response = await onStartSession("scrabble", { modeKey });
      const snapshot = response?.arcadeSession || null;
      if (!snapshot?.sessionId) throw new Error("session_unavailable");
      applySnapshot(snapshot);
      setResult(null);
      setSettling(false);
      setApiErr("");
    } catch {
      setSessionId("");
      setRack([]);
      setWord("");
      setTimeLeft(timeLimit);
      setStatus("playing");
      setResult(null);
      setSettling(false);
      setApiErr("");
      setSessionErr("Не удалось загрузить буквы раунда. Попробуйте ещё раз.");
    } finally {
      setSessionBusy(false);
    }
  }, [applySnapshot, modeKey, onStartSession, timeLimit]);

  useEffect(() => {
    if (!open) return;
    startSession().catch(() => {});
  }, [open, startSession]);

  useEffect(() => {
    if (!open || status !== "playing") return;
    const interval = setInterval(() => {
      const left = Math.max(0, (endAtRef.current - Date.now()) / 1000);
      setTimeLeft(left);
      if (left <= 0) setStatus("loss");
    }, 300);
    return () => clearInterval(interval);
  }, [open, status]);

  useEffect(() => {
    if (status === "playing") return;
    if (settling || result || !sessionId) return;
    setSettling(true);
    setApiErr("");
    if (!onFinishSession) {
      setSettling(false);
      setApiErr("Серверный игровой протокол недоступен.");
      return;
    }
    onFinishSession(sessionId)
      .then((response) => {
        if (response?.arcadeSession) applySnapshot(response.arcadeSession);
        setResult(response?.result || response);
      })
      .catch((e) => setApiErr(e?.message || String(e)))
      .finally(() => setSettling(false));
  }, [applySnapshot, onFinishSession, result, sessionId, settling, status]);

  async function handleSubmit() {
    if (status !== "playing" || disabled || readOnly || sessionBusy || !sessionId || !normalizedWord) return;
    if (!onMoveSession) {
      setApiErr("Серверный игровой протокол недоступен.");
      return;
    }
    setSessionBusy(true);
    setApiErr("");
    try {
      const response = await onMoveSession(sessionId, { word: normalizedWord });
      const snapshot = response?.arcadeSession || null;
      if (!snapshot) throw new Error("move_unavailable");
      applySnapshot(snapshot);
    } catch (e) {
      setApiErr(e?.message || String(e));
    } finally {
      setSessionBusy(false);
    }
  }

  return (
    <ArcadeOverlay open={open} className="scrabble-overlay">
      <div className="scrabble-panel">
        <div className="scrabble-head">
          <div>
            <div className="scrabble-title">Эрудит-блиц</div>
            <div className="small">Режим: {modeLabel} • Вход: {entryLabel} • Награда: {rewardRange}</div>
          </div>
          <button className="btn secondary" onClick={onClose}>Выйти</button>
        </div>

        <div className="scrabble-hud">
          <div className="hud-card">
            <div className="hud-label">Время</div>
            <div className="hud-value">{Math.ceil(timeLeft)}с</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">Буквы</div>
            <div className="hud-value">{rack.length}</div>
          </div>
        </div>

        <div className="scrabble-rack" role="list" aria-label="Набор букв">
          {rack.map((letter, idx) => (
            <span key={`${letter}-${idx}`} className="scrabble-tile" role="listitem">{letter}</span>
          ))}
        </div>
        <div className={`small scrabble-word-state ${normalizedWord ? (isWordPlayable ? "ok" : "bad") : ""}`}>
          {normalizedWord
            ? (isWordPlayable ? "Слово можно составить" : "Слово должно состоять из этих букв и быть не короче 3 символов")
            : "Собери слово из доступных букв"}
        </div>

        <div className="scrabble-input">
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="Введи слово"
            aria-label="Слово из доступных букв"
            disabled={disabled || readOnly || sessionBusy || !sessionId || status !== "playing"}
          />
          <button className="btn" onClick={handleSubmit} disabled={disabled || readOnly || sessionBusy || !sessionId || status !== "playing" || !normalizedWord}>
            Проверить
          </button>
        </div>

        {disabled ? <div className="badge off">Аркада закрыта DM</div> : null}
        {readOnly ? <div className="badge warn">Режим только чтения: действия отключены</div> : null}
        {sessionBusy ? <div className="badge warn">Подготавливаю набор букв...</div> : null}
        {sessionErr ? <div className="badge off">{sessionErr}</div> : null}

        {status !== "playing" ? (
          <div className={`scrabble-result ${status}`}>
            <div className="scrabble-result-title">{status === "win" ? "Победа!" : "Поражение"}</div>
            {settling ? <div className="badge warn">Начисляю билеты...</div> : null}
            {apiErr ? (
              <div className="badge off">
                Ошибка начисления: {apiErr}
              </div>
            ) : null}
            {result ? (
              <div className="badge ok">
                {result.outcome === "win" ? `+${result.reward}` : `-${result.penalty + result.entryCost}`} билетов
              </div>
            ) : null}
            <div className="row" style={{ gap: 8 }}>
              {result && !settling ? (
                <button className="btn" onClick={() => startSession().catch(() => {})} disabled={sessionBusy}>Сыграть снова</button>
              ) : null}
              <button className="btn secondary" onClick={onClose}>Закрыть</button>
            </div>
          </div>
        ) : null}
      </div>
    </ArcadeOverlay>
  );
}
