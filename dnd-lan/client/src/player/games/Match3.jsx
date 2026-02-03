import React, { useEffect, useRef, useState } from "react";

const SIZE = 6;
const COLORS = ["ruby", "amber", "emerald", "sapphire", "amethyst", "bone"];
const MOVES_TOTAL = 18;
const TARGET_SCORE = 120;
const SCORE_PER_TILE = 5;

let tileId = 1;
const nextId = () => tileId++;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function randColor(exclude) {
  let pick = COLORS[Math.floor(Math.random() * COLORS.length)];
  if (!exclude) return pick;
  let guard = 0;
  while (exclude.includes(pick) && guard < 12) {
    pick = COLORS[Math.floor(Math.random() * COLORS.length)];
    guard += 1;
  }
  return pick;
}

function makeTile(color) {
  return { id: nextId(), color };
}

function createBoard() {
  const board = new Array(SIZE * SIZE);
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      let color = randColor();
      const left1 = c > 0 ? board[r * SIZE + (c - 1)]?.color : null;
      const left2 = c > 1 ? board[r * SIZE + (c - 2)]?.color : null;
      const up1 = r > 0 ? board[(r - 1) * SIZE + c]?.color : null;
      const up2 = r > 1 ? board[(r - 2) * SIZE + c]?.color : null;

      let guard = 0;
      while ((color === left1 && color === left2) || (color === up1 && color === up2)) {
        color = randColor([left1, up1].filter(Boolean));
        guard += 1;
        if (guard > 10) break;
      }
      board[r * SIZE + c] = makeTile(color);
    }
  }
  return board;
}

function toIndex(r, c) {
  return r * SIZE + c;
}

function getCoords(idx) {
  return { r: Math.floor(idx / SIZE), c: idx % SIZE };
}

function isAdjacent(a, b) {
  const ar = Math.floor(a / SIZE);
  const ac = a % SIZE;
  const br = Math.floor(b / SIZE);
  const bc = b % SIZE;
  return (Math.abs(ar - br) + Math.abs(ac - bc)) === 1;
}

function findMatches(board) {
  const matched = new Set();
  let maxRun = 0;

  for (let r = 0; r < SIZE; r += 1) {
    let runColor = null;
    let runStart = 0;
    let runLen = 0;
    for (let c = 0; c < SIZE; c += 1) {
      const tile = board[toIndex(r, c)];
      const color = tile?.color || null;
      if (color && color === runColor) {
        runLen += 1;
      } else {
        if (runLen >= 3) {
          maxRun = Math.max(maxRun, runLen);
          for (let k = 0; k < runLen; k += 1) {
            matched.add(toIndex(r, runStart + k));
          }
        }
        runColor = color;
        runStart = c;
        runLen = color ? 1 : 0;
      }
    }
    if (runLen >= 3) {
      maxRun = Math.max(maxRun, runLen);
      for (let k = 0; k < runLen; k += 1) {
        matched.add(toIndex(r, runStart + k));
      }
    }
  }

  for (let c = 0; c < SIZE; c += 1) {
    let runColor = null;
    let runStart = 0;
    let runLen = 0;
    for (let r = 0; r < SIZE; r += 1) {
      const tile = board[toIndex(r, c)];
      const color = tile?.color || null;
      if (color && color === runColor) {
        runLen += 1;
      } else {
        if (runLen >= 3) {
          maxRun = Math.max(maxRun, runLen);
          for (let k = 0; k < runLen; k += 1) {
            matched.add(toIndex(runStart + k, c));
          }
        }
        runColor = color;
        runStart = r;
        runLen = color ? 1 : 0;
      }
    }
    if (runLen >= 3) {
      maxRun = Math.max(maxRun, runLen);
      for (let k = 0; k < runLen; k += 1) {
        matched.add(toIndex(runStart + k, c));
      }
    }
  }

  return { matched, maxRun };
}

function collapseBoard(board) {
  const next = board.slice();
  for (let c = 0; c < SIZE; c += 1) {
    const col = [];
    for (let r = SIZE - 1; r >= 0; r -= 1) {
      const tile = next[toIndex(r, c)];
      if (tile) col.push(tile);
    }
    let r = SIZE - 1;
    for (const tile of col) {
      next[toIndex(r, c)] = tile;
      r -= 1;
    }
    while (r >= 0) {
      next[toIndex(r, c)] = makeTile(randColor());
      r -= 1;
    }
  }
  return next;
}

function hasAnyMoves(board) {
  for (let i = 0; i < board.length; i += 1) {
    const { r, c } = getCoords(i);
    const right = c + 1 < SIZE ? toIndex(r, c + 1) : null;
    const down = r + 1 < SIZE ? toIndex(r + 1, c) : null;
    for (const j of [right, down]) {
      if (j == null) continue;
      const swapped = swap(board, i, j);
      if (findMatches(swapped).matched.size > 0) return true;
    }
  }
  return false;
}

function swap(board, a, b) {
  const next = board.slice();
  const temp = next[a];
  next[a] = next[b];
  next[b] = temp;
  return next;
}

export default function Match3Game({
  open,
  onClose,
  onSubmitResult,
  disabled,
  entryCost = 0,
  rewardRange = "—",
  readOnly
}) {
  const [board, setBoard] = useState(() => createBoard());
  const [selected, setSelected] = useState(null);
  const [matched, setMatched] = useState([]);
  const [busy, setBusy] = useState(false);
  const [movesLeft, setMovesLeft] = useState(MOVES_TOTAL);
  const [score, setScore] = useState(0);
  const [comboFlash, setComboFlash] = useState("");
  const [shake, setShake] = useState(false);
  const [status, setStatus] = useState("playing");
  const [apiErr, setApiErr] = useState("");
  const [result, setResult] = useState(null);
  const [settling, setSettling] = useState(false);
  const maxMatchRef = useRef(0);

  const progress = Math.min(100, Math.round((score / TARGET_SCORE) * 100));

  function resetGame() {
    const next = createBoard();
    setBoard(next);
    setSelected(null);
    setMatched([]);
    setBusy(false);
    setMovesLeft(MOVES_TOTAL);
    setScore(0);
    setComboFlash("");
    setShake(false);
    setStatus("playing");
    setApiErr("");
    setResult(null);
    setSettling(false);
    maxMatchRef.current = 0;
  }

  useEffect(() => {
    if (!open) return;
    resetGame();
  }, [open]);

  useEffect(() => {
    if (status === "playing") return;
    if (!onSubmitResult || settling || result) return;
    const maxRun = maxMatchRef.current || 0;
    const performance = maxRun >= 5 ? "combo5" : maxRun >= 4 ? "combo4" : "normal";
    setSettling(true);
    setApiErr("");
    onSubmitResult({ outcome: status, performance })
      .then((r) => setResult(r))
      .catch((e) => setApiErr(e?.message || String(e)))
      .finally(() => setSettling(false));
  }, [status, onSubmitResult, settling, result]);

  useEffect(() => {
    if (status !== "playing") return;
    if (score >= TARGET_SCORE) setStatus("win");
    else if (movesLeft <= 0) setStatus("loss");
  }, [score, movesLeft, status]);

  async function resolveBoard(nextBoard) {
    let combo = 1;
    let current = nextBoard;
    let maxRunLocal = 0;
    // eslint-disable-next-line no-constant-condition -- intentional: resolve cascades until no matches
    while (true) {
      const { matched: m, maxRun } = findMatches(current);
      if (m.size === 0) break;
      maxRunLocal = Math.max(maxRunLocal, maxRun);
      maxMatchRef.current = Math.max(maxMatchRef.current, maxRun);
      setMatched(Array.from(m));
      setComboFlash(`Комбо x${combo}`);
      const bonus = 1 + (combo - 1) * 0.2;
      const addScore = Math.round(m.size * SCORE_PER_TILE * bonus);
      setScore((s) => s + addScore);
      await sleep(240);

      const cleared = current.map((tile, idx) => (m.has(idx) ? null : tile));
      setMatched([]);
      current = collapseBoard(cleared);
      setBoard(current);
      await sleep(120);
      combo += 1;
    }
    if (!hasAnyMoves(current)) {
      setShake(true);
      await sleep(200);
      setShake(false);
      const reshuffle = createBoard();
      setBoard(reshuffle);
    }
    setComboFlash("");
    return maxRunLocal;
  }

  async function handleSelect(idx) {
    if (busy || status !== "playing" || disabled || readOnly) return;
    if (selected == null) {
      setSelected(idx);
      return;
    }
    if (selected === idx) {
      setSelected(null);
      return;
    }
    if (!isAdjacent(selected, idx)) {
      setSelected(idx);
      return;
    }

    setBusy(true);
    const swapped = swap(board, selected, idx);
    const { matched: m } = findMatches(swapped);
    if (m.size === 0) {
      setBoard(swapped);
      await sleep(120);
      setBoard(board);
      setShake(true);
      await sleep(200);
      setShake(false);
      setSelected(null);
      setBusy(false);
      return;
    }

    setBoard(swapped);
    setSelected(null);
    await sleep(120);
    await resolveBoard(swapped);
    setMovesLeft((v) => Math.max(0, v - 1));
    setBusy(false);
  }

  async function retrySettlement() {
    if (!onSubmitResult) return;
    const maxRun = maxMatchRef.current || 0;
    const performance = maxRun >= 5 ? "combo5" : maxRun >= 4 ? "combo4" : "normal";
    setSettling(true);
    setApiErr("");
    try {
      const r = await onSubmitResult({ outcome: status, performance });
      setResult(r);
    } catch (e) {
      setApiErr(e?.message || String(e));
    } finally {
      setSettling(false);
    }
  }

  if (!open) return null;

  const entryLabel = entryCost
    ? `${entryCost} ${entryCost === 1 ? "билет" : entryCost < 5 ? "билета" : "билетов"}`
    : "бесплатно";

  return (
    <div className="match3-overlay">
      <div className="match3-panel">
        <div className="match3-head">
          <div>
            <div className="match3-title">Три в ряд</div>
            <div className="small">Вход: {entryLabel} • Награда: {rewardRange}</div>
          </div>
          <button className="btn secondary" onClick={onClose}>Выйти</button>
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
            <div className="hud-value">{TARGET_SCORE}</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">Серия</div>
            <div className="hud-value">{comboFlash || "—"}</div>
          </div>
        </div>

        <div className="match3-progress">
          <div className="match3-progress-bar" style={{ width: `${progress}%` }} />
        </div>

        <div className={`match3-board${shake ? " shake" : ""}`}>
          {board.map((tile, idx) => {
            const isSelected = selected === idx;
            const isMatched = matched.includes(idx);
            return (
              <button
                key={tile?.id || `empty_${idx}`}
                type="button"
                className={`match3-tile ${tile?.color || "empty"}${isSelected ? " selected" : ""}${isMatched ? " matched" : ""}`}
                onClick={() => handleSelect(idx)}
                disabled={busy || status !== "playing" || disabled || readOnly}
              >
                <span className="match3-gem" />
              </button>
            );
          })}
        </div>

        <div className="match3-footer small">
          Собери 3+ в ряд. Большие матчи дают лучшую награду.
        </div>

        {disabled ? <div className="badge off">Аркада закрыта DM</div> : null}
        {readOnly ? <div className="badge warn">Read-only: действия отключены</div> : null}

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
                <button className="btn" onClick={resetGame}>Сыграть снова</button>
              ) : null}
              <button className="btn secondary" onClick={onClose}>Закрыть</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
