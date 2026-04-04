import React, { useCallback, useEffect, useState } from "react";
import ArcadeOverlay from "./ArcadeOverlay.jsx";

export default function TicTacToeGame({
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
  const modeKey = String(mode?.key || "normal");
  const [board, setBoard] = useState(() => Array(9).fill(null));
  const [winnerLine, setWinnerLine] = useState(null);
  const [sessionId, setSessionId] = useState("");
  const [roundsToWin, setRoundsToWin] = useState(Number(mode?.roundsToWin || 2));
  const [playerWins, setPlayerWins] = useState(0);
  const [aiWins, setAiWins] = useState(0);
  const [status, setStatus] = useState("playing");
  const [busy, setBusy] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionErr, setSessionErr] = useState("");
  const [settling, setSettling] = useState(false);
  const [result, setResult] = useState(null);
  const [apiErr, setApiErr] = useState("");

  const entryLabel = entryCost
    ? `${entryCost} ${entryCost === 1 ? "билет" : entryCost < 5 ? "билета" : "билетов"}`
    : "бесплатно";
  const modeLabel = mode?.label || "Обычный";

  const applySnapshot = useCallback((snapshot) => {
    const state = snapshot?.state || {};
    setSessionId(String(snapshot?.sessionId || ""));
    setBoard(Array.isArray(state.board) && state.board.length === 9 ? state.board : Array(9).fill(null));
    setWinnerLine(Array.isArray(state.winnerLine) ? state.winnerLine : null);
    setRoundsToWin(Math.max(1, Number(state.roundsToWin || mode?.roundsToWin || 1)));
    setPlayerWins(Math.max(0, Number(state.playerWins || 0)));
    setAiWins(Math.max(0, Number(state.aiWins || 0)));
    setStatus(String(state.status || "playing"));
  }, [mode?.roundsToWin]);

  const startSession = useCallback(async () => {
    setSessionBusy(true);
    setSessionErr("");
    setApiErr("");
    try {
      if (!onStartSession) throw new Error("session_api_unavailable");
      const response = await onStartSession("ttt", { modeKey });
      const snapshot = response?.arcadeSession || null;
      if (!snapshot?.sessionId) throw new Error("session_unavailable");
      applySnapshot(snapshot);
      setBusy(false);
      setSettling(false);
      setResult(null);
    } catch {
      setSessionId("");
      setBoard(Array(9).fill(null));
      setWinnerLine(null);
      setRoundsToWin(Number(mode?.roundsToWin || 2));
      setPlayerWins(0);
      setAiWins(0);
      setStatus("playing");
      setSettling(false);
      setResult(null);
      setSessionErr("Не удалось загрузить матч. Попробуйте ещё раз.");
    } finally {
      setSessionBusy(false);
    }
  }, [applySnapshot, mode?.roundsToWin, modeKey, onStartSession]);

  useEffect(() => {
    if (!open) return;
    startSession().catch(() => {});
  }, [open, startSession]);

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

  async function handlePick(idx) {
    if (busy || sessionBusy || !sessionId || status !== "playing" || disabled || readOnly) return;
    if (board[idx]) return;
    if (!onMoveSession) {
      setApiErr("Серверный игровой протокол недоступен.");
      return;
    }

    setBusy(true);
    setApiErr("");
    try {
      const response = await onMoveSession(sessionId, { index: idx });
      const snapshot = response?.arcadeSession || null;
      if (!snapshot) throw new Error("move_unavailable");
      applySnapshot(snapshot);
    } catch (e) {
      setApiErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ArcadeOverlay open={open} className="ttt-overlay">
      <div className="ttt-panel">
        <div className="ttt-head">
          <div>
            <div className="ttt-title">Крестики-нолики</div>
            <div className="small">Режим: {modeLabel} • Вход: {entryLabel} • Награда: {rewardRange}</div>
          </div>
          <button className="btn secondary" onClick={onClose}>Выйти</button>
        </div>

        <div className="ttt-scoreboard">
          <div className="hud-card">
            <div className="hud-label">Ты</div>
            <div className="hud-value">{playerWins}</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">ИИ</div>
            <div className="hud-value">{aiWins}</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">Раунд</div>
            <div className="hud-value">{roundsToWin} побед до матча</div>
          </div>
        </div>

        <div className="ttt-board">
          {board.map((cell, idx) => (
            <button
              key={idx}
              type="button"
              className={`ttt-cell ${cell ? "filled" : ""}${winnerLine?.includes(idx) ? " win-cell" : ""}`}
              onClick={() => handlePick(idx)}
              disabled={busy || sessionBusy || !sessionId || status !== "playing" || disabled || readOnly || !!cell}
              aria-label={`Клетка ${idx + 1}${cell ? ` ${cell}` : ""}`}
            >
              {cell || ""}
            </button>
          ))}
        </div>
        <div className="small arcade-game-hint">Нажимай на свободные клетки. Выиграй {roundsToWin} раунда раньше ИИ.</div>

        {disabled ? <div className="badge off">Аркада закрыта DM</div> : null}
        {readOnly ? <div className="badge warn">Режим только чтения: действия отключены</div> : null}
        {sessionBusy ? <div className="badge warn">Загрузка матча...</div> : null}
        {sessionErr ? <div className="badge off">{sessionErr}</div> : null}

        {status !== "playing" ? (
          <div className={`ttt-result ${status}`}>
            <div className="ttt-result-title">{status === "win" ? "Победа!" : "Поражение"}</div>
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
