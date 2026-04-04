import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArcadeOverlay from "./ArcadeOverlay.jsx";
import { normalizeMatch3Config } from "../../../../shared/match3Domain.js";

export default function Match3Game({
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
  const config = useMemo(() => normalizeMatch3Config(mode || {}), [mode]);
  const modeKey = String(config.key || mode?.key || "normal");

  const [sessionId, setSessionId] = useState("");
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionErr, setSessionErr] = useState("");
  const [board, setBoard] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [movesLeft, setMovesLeft] = useState(config.moves);
  const [score, setScore] = useState(0);
  const [comboFlash, setComboFlash] = useState("");
  const [shake, setShake] = useState(false);
  const [status, setStatus] = useState("playing");
  const [apiErr, setApiErr] = useState("");
  const [result, setResult] = useState(null);
  const [settling, setSettling] = useState(false);

  const submittedRef = useRef(false);
  const comboTimerRef = useRef(null);

  const progress = Math.min(100, Math.round((score / config.target) * 100));
  const targetLeft = Math.max(0, config.target - score);

  const clearComboLater = useCallback(() => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => {
      setComboFlash("");
      comboTimerRef.current = null;
    }, 900);
  }, []);

  useEffect(() => () => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
  }, []);

  const applySnapshot = useCallback((snapshot) => {
    const state = snapshot?.state || {};
    setSessionId(String(snapshot?.sessionId || ""));
    setBoard(Array.isArray(state.board) ? state.board.slice() : []);
    setMovesLeft(Math.max(0, Number(state.movesLeft || 0)));
    setScore(Math.max(0, Number(state.score || 0)));
    setStatus(String(state.status || "playing"));
  }, []);

  const applyMoveFx = useCallback((snapshot) => {
    const state = snapshot?.state || {};
    if (Number(state.comboCount || 0) > 1) {
      setComboFlash(`Комбо x${Number(state.comboCount || 0)}`);
      clearComboLater();
    } else if (Number(state.maxRunThisMove || 0) >= 4) {
      setComboFlash(`Серия ${Number(state.maxRunThisMove || 0)}`);
      clearComboLater();
    } else {
      setComboFlash("");
    }
  }, [clearComboLater]);

  const startSession = useCallback(async () => {
    setSessionBusy(true);
    setSessionErr("");
    try {
      if (!onStartSession) throw new Error("session_api_unavailable");
      const response = await onStartSession("match3", { modeKey });
      const snapshot = response?.arcadeSession || null;
      if (!snapshot?.sessionId) throw new Error("session_unavailable");
      applySnapshot(snapshot);
      setSelected(null);
      setBusy(false);
      setComboFlash("");
      setShake(false);
      setApiErr("");
      setResult(null);
      setSettling(false);
      submittedRef.current = false;
    } catch {
      setSessionId("");
      setBoard([]);
      setMovesLeft(config.moves);
      setScore(0);
      setSelected(null);
      setBusy(false);
      setComboFlash("");
      setShake(false);
      setStatus("playing");
      setApiErr("");
      setResult(null);
      setSettling(false);
      submittedRef.current = false;
      setSessionErr("Не удалось загрузить раунд. Попробуйте ещё раз.");
    } finally {
      setSessionBusy(false);
    }
  }, [applySnapshot, config.moves, modeKey, onStartSession]);

  const resetGame = useCallback(() => {
    setSelected(null);
    setBusy(false);
    setComboFlash("");
    setShake(false);
    startSession().catch(() => {});
  }, [startSession]);

  useEffect(() => {
    if (!open) return;
    resetGame();
  }, [open, resetGame]);

  useEffect(() => {
    if (status === "playing") return;
    if (settling || result || submittedRef.current || !sessionId) return;
    submittedRef.current = true;
    setSettling(true);
    setApiErr("");
    if (!onFinishSession) {
      submittedRef.current = false;
      setSettling(false);
      setApiErr("Серверный игровой протокол недоступен.");
      return;
    }
    onFinishSession(sessionId)
      .then((response) => {
        if (response?.arcadeSession) applySnapshot(response.arcadeSession);
        setResult(response?.result || response);
      })
      .catch((e) => {
        submittedRef.current = false;
        setApiErr(e?.message || String(e));
      })
      .finally(() => setSettling(false));
  }, [applySnapshot, onFinishSession, result, sessionId, settling, status]);

  async function handleSelect(idx) {
    if (busy || status !== "playing" || disabled || readOnly || sessionBusy || !sessionId) return;
    if (board[idx]?.blocked) return;

    if (selected == null) {
      setSelected(idx);
      return;
    }
    if (selected === idx) {
      setSelected(null);
      return;
    }

    if (!onMoveSession) {
      setApiErr("Серверный игровой протокол недоступен.");
      setSelected(null);
      return;
    }

    setBusy(true);
    setApiErr("");
    try {
      const response = await onMoveSession(sessionId, { from: selected, to: idx });
      const snapshot = response?.arcadeSession || null;
      if (!snapshot) throw new Error("move_unavailable");
      applySnapshot(snapshot);
      applyMoveFx(snapshot);
      setSelected(null);

      if (snapshot?.state?.reshuffled) {
        setShake(true);
        await new Promise((resolve) => setTimeout(resolve, 160));
        setShake(false);
      }
    } catch {
      setShake(true);
      await new Promise((resolve) => setTimeout(resolve, 180));
      setShake(false);
      setSelected(null);
    } finally {
      setBusy(false);
    }
  }

  async function retrySettlement() {
    if (settling || !sessionId) return;
    submittedRef.current = true;
    setSettling(true);
    setApiErr("");
    try {
      if (!onFinishSession) throw new Error("Серверный игровой протокол недоступен.");
      const response = await onFinishSession(sessionId);
      if (response?.arcadeSession) applySnapshot(response.arcadeSession);
      setResult(response?.result || response);
    } catch (e) {
      submittedRef.current = false;
      setApiErr(e?.message || String(e));
    } finally {
      setSettling(false);
    }
  }

  const entryLabel = entryCost
    ? `${entryCost} ${entryCost === 1 ? "билет" : entryCost < 5 ? "билета" : "билетов"}`
    : "бесплатно";
  const modeLabel = mode?.label || "Классика";

  return (
    <ArcadeOverlay open={open} className="match3-overlay">
      <div className="match3-panel">
        <div className="match3-head">
          <div>
            <div className="match3-title">Три в ряд</div>
            <div className="small">Режим: {modeLabel} • Вход: {entryLabel} • Награда: {rewardRange}</div>
          </div>
          <button className="btn secondary" onClick={onClose} disabled={sessionBusy}>Выйти</button>
        </div>

        <div className="match3-hud">
          <div className="hud-card">
            <div className="hud-label">Очки</div>
            <div className="hud-value">{score}</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">Ходы</div>
            <div className="hud-value">{movesLeft}</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">Цель</div>
            <div className="hud-value">{config.target}</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">Серия</div>
            <div className="hud-value">{comboFlash || "—"}</div>
          </div>
        </div>

        <div className="match3-progress">
          <div className="match3-progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="small arcade-game-hint">До цели осталось: {targetLeft}</div>
        {sessionBusy ? <div className="badge warn">Подготавливаю расклад...</div> : null}
        {sessionErr ? <div className="badge off">{sessionErr}</div> : null}

        <div
          className={`match3-board${shake ? " shake" : ""}`}
          style={{ gridTemplateColumns: `repeat(${config.size}, minmax(0, 1fr))` }}
        >
          {board.map((tile, idx) => {
            const isSelected = selected === idx;
            return (
              <button
                key={tile?.id || `empty_${idx}`}
                type="button"
                className={`match3-tile ${tile?.color || "empty"}${tile?.blocked ? " blocked" : ""}${isSelected ? " selected" : ""}`}
                onClick={() => handleSelect(idx)}
                disabled={busy || status !== "playing" || disabled || readOnly || sessionBusy || tile?.blocked}
                aria-label={`Клетка ${idx + 1}${tile?.blocked ? " заблокирована" : ""}${tile?.color ? ` ${tile.color}` : ""}`}
              >
                <span className="match3-gem" />
              </button>
            );
          })}
        </div>

        <div className="match3-footer small">
          Собери 3+ в ряд. Результат проверяется по истории ходов, а не по числам клиента.
        </div>

        {disabled ? <div className="badge off">Аркада закрыта DM</div> : null}
        {readOnly ? <div className="badge warn">Режим только чтения: действия отключены</div> : null}

        {status !== "playing" ? (
          <div className={`match3-result ${status}`}>
            <div className="match3-result-title">{status === "win" ? "Победа!" : "Поражение"}</div>
            <div className="small">Итог: {score} очков</div>
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
                <button className="btn" onClick={resetGame} disabled={sessionBusy}>Сыграть снова</button>
              ) : null}
              <button className="btn secondary" onClick={onClose}>Закрыть</button>
            </div>
          </div>
        ) : null}
      </div>
    </ArcadeOverlay>
  );
}
