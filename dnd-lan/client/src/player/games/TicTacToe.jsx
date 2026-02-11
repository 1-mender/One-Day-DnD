import React, { useCallback, useEffect, useMemo, useState } from "react";
import { makeProof } from "../../lib/gameProof.js";

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

function getWinner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function getWinnerLine(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return [a, b, c];
  }
  return null;
}

function findWinningMove(board, symbol) {
  for (const [a, b, c] of LINES) {
    const line = [board[a], board[b], board[c]];
    const empties = [a, b, c].filter((idx) => !board[idx]);
    if (empties.length !== 1) continue;
    const filled = line.filter(Boolean);
    if (filled.length === 2 && filled.every((v) => v === symbol)) {
      return empties[0];
    }
  }
  return null;
}

function pickAiMove(board) {
  const win = findWinningMove(board, "O");
  if (win != null) return win;
  const block = findWinningMove(board, "X");
  if (block != null) return block;
  if (!board[4]) return 4;
  const empty = board.map((v, idx) => (v ? null : idx)).filter((v) => v != null);
  return empty[Math.floor(Math.random() * empty.length)];
}

export default function TicTacToeGame({
  open,
  onClose,
  onSubmitResult,
  disabled,
  entryCost = 0,
  rewardRange = "—",
  mode,
  readOnly
}) {
  const roundsToWin = Number(mode?.roundsToWin || 2);
  const [board, setBoard] = useState(() => Array(9).fill(null));
  const [moves, setMoves] = useState([]);
  const [playerWins, setPlayerWins] = useState(0);
  const [aiWins, setAiWins] = useState(0);
  const [status, setStatus] = useState("playing");
  const [settling, setSettling] = useState(false);
  const [result, setResult] = useState(null);
  const [apiErr, setApiErr] = useState("");

  const entryLabel = entryCost
    ? `${entryCost} ${entryCost === 1 ? "билет" : entryCost < 5 ? "билета" : "билетов"}`
    : "бесплатно";
  const modeLabel = mode?.label || "Обычный";

  const winnerLine = useMemo(() => getWinnerLine(board), [board]);
  const winner = useMemo(() => (winnerLine ? board[winnerLine[0]] : getWinner(board)), [board, winnerLine]);
  const isDraw = useMemo(() => board.every(Boolean) && !winner, [board, winner]);

  const resetRound = useCallback((nextPlayerWins, nextAiWins) => {
    setBoard(Array(9).fill(null));
    setMoves([]);
    setPlayerWins(nextPlayerWins);
    setAiWins(nextAiWins);
  }, []);

  const resetMatch = useCallback(() => {
    setBoard(Array(9).fill(null));
    setMoves([]);
    setPlayerWins(0);
    setAiWins(0);
    setStatus("playing");
    setSettling(false);
    setResult(null);
    setApiErr("");
  }, []);

  useEffect(() => {
    if (!open) return;
    resetMatch();
  }, [open, resetMatch]);

  useEffect(() => {
    if (status !== "playing") return;
    if (!winner && !isDraw) return;
    if (winner === "X") {
      const next = playerWins + 1;
      if (next >= roundsToWin) {
        setStatus("win");
      } else {
        resetRound(next, aiWins);
      }
    } else if (winner === "O") {
      const next = aiWins + 1;
      if (next >= roundsToWin) {
        setStatus("loss");
      } else {
        resetRound(playerWins, next);
      }
    } else if (isDraw) {
      resetRound(playerWins, aiWins);
    }
  }, [winner, isDraw, playerWins, aiWins, roundsToWin, status, resetRound]);

  useEffect(() => {
    if (status === "playing") return;
    if (!onSubmitResult || settling || result) return;
    const performance = status === "win" && aiWins === 0 && roundsToWin > 1 ? "sweep" : "normal";
    const payload = { moves, playerSymbol: "X", outcome: status };
    const proof = makeProof("", payload);
    setSettling(true);
    setApiErr("");
    onSubmitResult({ outcome: status, performance, payload, proof })
      .then((r) => setResult(r))
      .catch((e) => setApiErr(e?.message || String(e)))
      .finally(() => setSettling(false));
  }, [status, onSubmitResult, settling, result, moves, aiWins, roundsToWin]);

  function handlePick(idx) {
    if (status !== "playing" || disabled || readOnly) return;
    if (board[idx]) return;
    const next = board.slice();
    next[idx] = "X";
    const nextMoves = [...moves, idx];
    const hasWinner = getWinner(next);
    if (!hasWinner && next.some((v) => !v)) {
      const aiMove = pickAiMove(next);
      if (aiMove != null) {
        next[aiMove] = "O";
        nextMoves.push(aiMove);
      }
    }
    setBoard(next);
    setMoves(nextMoves);
  }

  if (!open) return null;

  return (
    <div className="ttt-overlay">
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
              disabled={status !== "playing" || disabled || readOnly || !!cell}
              aria-label={`Cell ${idx + 1}${cell ? ` ${cell}` : ""}`}
            >
              {cell || ""}
            </button>
          ))}
        </div>
        <div className="small arcade-game-hint">Tap any free cell. Win {roundsToWin} rounds before AI.</div>

        {disabled ? <div className="badge off">Аркада закрыта DM</div> : null}
        {readOnly ? <div className="badge warn">Read-only: действия отключены</div> : null}

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
                <button className="btn" onClick={resetMatch}>Сыграть снова</button>
              ) : null}
              <button className="btn secondary" onClick={onClose}>Закрыть</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
