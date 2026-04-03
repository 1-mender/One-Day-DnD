import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArcadeOverlay from "./ArcadeOverlay.jsx";

const SUIT_SYMBOLS = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠"
};
const GRID_COLS = 4;

export default function GuessCardGame({
  open,
  onClose,
  onSubmitResult,
  onStartSession,
  onMoveSession,
  onFinishSession,
  disabled,
  entryCost = 0,
  rewardRange = "—",
  mode,
  readOnly
}) {
  const modeConfig = useMemo(() => ({
    maxAttempts: Number(mode?.maxAttempts || 3),
    timeLimit: Number(mode?.timeLimit || 40),
    hintCount: Number(mode?.hintCount || 3),
    key: String(mode?.key || "easy")
  }), [mode]);
  const [sessionId, setSessionId] = useState("");
  const [deck, setDeck] = useState([]);
  const [target, setTarget] = useState(null);
  const [hints, setHints] = useState([]);
  const [attempt, setAttempt] = useState(1);
  const [maxAttempts, setMaxAttempts] = useState(modeConfig.maxAttempts);
  const [timeLeft, setTimeLeft] = useState(modeConfig.timeLimit);
  const [status, setStatus] = useState("playing");
  const [busy, setBusy] = useState(false);
  const [missId, setMissId] = useState(null);
  const [result, setResult] = useState(null);
  const [settling, setSettling] = useState(false);
  const [apiErr, setApiErr] = useState("");
  const [sessionErr, setSessionErr] = useState("");
  const [sessionBusy, setSessionBusy] = useState(false);
  const endAtRef = useRef(0);

  const entryLabel = entryCost
    ? `${entryCost} ${entryCost === 1 ? "билет" : entryCost < 5 ? "билета" : "билетов"}`
    : "бесплатно";
  const modeLabel = mode?.label || "Классика";
  const modeKey = String(modeConfig.key || mode?.key || "easy");

  const applySnapshot = useCallback((snapshot) => {
    const state = snapshot?.state || {};
    setSessionId(String(snapshot?.sessionId || ""));
    setDeck(Array.isArray(state.deck) ? state.deck : []);
    setTarget(state.target || null);
    setHints(Array.isArray(state.hints) ? state.hints : []);
    setAttempt(Math.max(1, Number(state.attempt || 1)));
    setMaxAttempts(Math.max(1, Number(state.maxAttempts || modeConfig.maxAttempts || 1)));
    setTimeLeft(Math.max(0, Number(state.timeLeftMs || 0) / 1000));
    setStatus(String(state.status || "playing"));
    endAtRef.current = Date.now() + Math.max(0, Number(state.timeLeftMs || 0));
  }, [modeConfig.maxAttempts]);

  const startSession = useCallback(async () => {
    setSessionBusy(true);
    setSessionErr("");
    try {
      if (!onStartSession) {
        throw new Error("session_api_unavailable");
      }
      const response = await onStartSession("guess", { modeKey });
      const snapshot = response?.arcadeSession || null;
      if (!snapshot?.sessionId) throw new Error("session_unavailable");
      applySnapshot(snapshot);
      setBusy(false);
      setMissId(null);
      setResult(null);
      setSettling(false);
      setApiErr("");
    } catch {
      setSessionId("");
      setDeck([]);
      setTarget(null);
      setHints([]);
      setAttempt(1);
      setMaxAttempts(modeConfig.maxAttempts);
      setStatus("playing");
      setResult(null);
      setSettling(false);
      setApiErr("");
      setSessionErr("Не удалось загрузить раунд. Попробуйте ещё раз.");
    } finally {
      setSessionBusy(false);
    }
  }, [applySnapshot, modeConfig.maxAttempts, modeKey, onStartSession]);

  useEffect(() => {
    if (!open) return;
    startSession().catch(() => {});
  }, [open, startSession]);

  useEffect(() => {
    if (!open || status !== "playing") return;
    const interval = setInterval(() => {
      const left = Math.max(0, (endAtRef.current - Date.now()) / 1000);
      setTimeLeft(left);
      if (left <= 0) {
        setStatus("loss");
      }
    }, 300);
    return () => clearInterval(interval);
  }, [open, status]);

  useEffect(() => {
    if (status === "playing") return;
    if (settling || result || !sessionId) return;
    setSettling(true);
    setApiErr("");
    const finishPromise = onFinishSession
      ? onFinishSession(sessionId)
      : onSubmitResult({ outcome: status, performance: "normal", payload: { modeKey } });
    finishPromise
      .then((response) => {
        if (response?.arcadeSession) applySnapshot(response.arcadeSession);
        setResult(response?.result || response);
      })
      .catch((e) => setApiErr(e?.message || String(e)))
      .finally(() => setSettling(false));
  }, [applySnapshot, modeKey, onFinishSession, onSubmitResult, result, sessionId, settling, status]);

  function isRevealed(id) {
    return deck.some((card) => card?.id === id && card?.revealed === true);
  }

  async function handlePick(card) {
    if (busy || sessionBusy || !sessionId || status !== "playing" || disabled || readOnly) return;
    if (!card?.id || isRevealed(card.id)) return;
    if (!onMoveSession) {
      setApiErr("Серверный игровой протокол недоступен.");
      return;
    }

    setBusy(true);
    setApiErr("");
    try {
      const response = await onMoveSession(sessionId, { cardId: card.id });
      const snapshot = response?.arcadeSession || null;
      if (!snapshot) throw new Error("move_unavailable");
      applySnapshot(snapshot);
      if (String(snapshot?.state?.status || "") !== "win") {
        setMissId(card.id);
        setTimeout(() => setMissId(null), 220);
      }
    } catch (e) {
      setApiErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function retrySettlement() {
    if (settling || !sessionId) return;
    setSettling(true);
    setApiErr("");
    try {
      const response = onFinishSession
        ? await onFinishSession(sessionId)
        : await onSubmitResult({ outcome: status, performance: "normal", payload: { modeKey } });
      if (response?.arcadeSession) applySnapshot(response.arcadeSession);
      setResult(response?.result || response);
    } catch (e) {
      setApiErr(e?.message || String(e));
    } finally {
      setSettling(false);
    }
  }

  return (
    <ArcadeOverlay open={open} className="guess-overlay">
      <div className="guess-panel">
        <div className="guess-head">
          <div>
            <div className="guess-title">Угадай карту</div>
            <div className="small">Режим: {modeLabel} | Вход: {entryLabel} | Награда: {rewardRange}</div>
          </div>
          <button className="btn secondary" onClick={onClose}>Выйти</button>
        </div>

        <div className="guess-hud">
          <div className="hud-card">
            <div className="hud-label">Попытка</div>
            <div className="hud-value">{Math.min(attempt, maxAttempts)}/{maxAttempts}</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">Время</div>
            <div className="hud-value">{Math.ceil(timeLeft)}с</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">Осталось</div>
            <div className="hud-value">{deck.filter((card) => !card?.revealed).length}</div>
          </div>
        </div>

        <div className="guess-timer">
          <div
            className="guess-timer-bar"
            data-urgent={timeLeft <= 7}
            style={{ width: `${Math.max(0, (timeLeft / modeConfig.timeLimit) * 100)}%` }}
          />
        </div>

        <div className="guess-hints">
          {hints.slice(0, Math.min(attempt, modeConfig.hintCount, hints.length)).map((h, idx) => (
            <div key={idx} className="guess-hint">{h}</div>
          ))}
        </div>
        <div className="small arcade-game-hint">
          Выбирай внимательно: осталось попыток {Math.max(0, maxAttempts - attempt + 1)}.
        </div>

        <div
          className="guess-grid"
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
        >
          {deck.map((card) => {
            const flipped = Boolean(card?.revealed) || status !== "playing";
            const rank = String(card?.rank || "");
            const suit = String(card?.suit || "");
            const color = String(card?.color || "");
            return (
              <button
                key={card.id}
                type="button"
                className={`guess-card${flipped ? " flipped" : ""}${missId === card.id ? " miss" : ""}`}
                onClick={() => handlePick(card)}
                disabled={busy || sessionBusy || !sessionId || status !== "playing" || disabled || readOnly}
                aria-label={rank && suit ? `Карта ${rank} ${SUIT_SYMBOLS[suit] || ""}` : "Скрытая карта"}
                data-revealed={flipped ? "true" : "false"}
              >
                <div className="guess-inner">
                  <div className="guess-face front">?</div>
                  <div className={`guess-face back ${color || "black"}`}>
                    <div className="guess-rank">{rank || "?"}</div>
                    <div className="guess-suit">{SUIT_SYMBOLS[suit] || ""}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {disabled ? <div className="badge off">Аркада закрыта DM</div> : null}
        {readOnly ? <div className="badge warn">Режим только чтения: действия отключены</div> : null}
        {sessionBusy ? <div className="badge warn">Загрузка раунда...</div> : null}
        {sessionErr ? <div className="badge off">{sessionErr}</div> : null}

        {status !== "playing" ? (
          <div className={`guess-result ${status}`}>
            <div className="guess-result-title">{status === "win" ? "Победа!" : "Поражение"}</div>
            <div className="small">Загаданная карта: {target ? `${target.rank} ${SUIT_SYMBOLS[target.suit]}` : "—"}</div>
            {settling ? <div className="badge warn">Начисляю билеты...</div> : null}
            {apiErr ? (
              <div className="badge off">
                Ошибка начисления: {apiErr}
                <button className="btn secondary" onClick={retrySettlement}>Повторить</button>
              </div>
            ) : null}
            {result ? (
              <div className="badge ok">
                {result.outcome === "win" ? `+${result.reward}` : `-${result.penalty + result.entryCost}`} билетов
              </div>
            ) : null}
            <div className="row" style={{ gap: 8 }}>
              {result && !settling ? (
                <button className="btn" onClick={() => startSession().catch(() => {})} disabled={sessionBusy}>
                  Сыграть снова
                </button>
              ) : null}
              <button className="btn secondary" onClick={onClose}>Закрыть</button>
            </div>
          </div>
        ) : null}
      </div>
    </ArcadeOverlay>
  );
}

