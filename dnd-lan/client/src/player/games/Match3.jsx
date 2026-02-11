import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const COLOR_POOL = ["ruby", "amber", "emerald", "sapphire", "amethyst", "bone", "topaz", "violet"];
const DEFAULT_CONFIG = {
  size: 6,
  moves: 18,
  target: 120,
  colors: 6,
  blocks: 0
};
const SCORE_PER_TILE = 5;

let tileId = 1;
const nextId = () => tileId++;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function randColor(colorPool, exclude) {
  let pick = colorPool[Math.floor(Math.random() * colorPool.length)];
  if (!exclude) return pick;
  let guard = 0;
  while (exclude.includes(pick) && guard < 12) {
    pick = colorPool[Math.floor(Math.random() * colorPool.length)];
    guard += 1;
  }
  return pick;
}

function makeTile(color, blocked = false) {
  return { id: nextId(), color, blocked };
}

function createBoard(config) {
  const size = config.size;
  const colorPool = COLOR_POOL.slice(0, Math.max(3, Math.min(COLOR_POOL.length, config.colors || DEFAULT_CONFIG.colors)));
  const board = new Array(size * size);
  const blockedPositions = new Set();
  while (blockedPositions.size < Math.min(config.blocks || 0, size * size)) {
    blockedPositions.add(Math.floor(Math.random() * size * size));
  }
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const idx = r * size + c;
      if (blockedPositions.has(idx)) {
        board[idx] = makeTile(null, true);
        continue;
      }
      let color = randColor(colorPool);
      const left1 = c > 0 ? board[r * size + (c - 1)] : null;
      const left2 = c > 1 ? board[r * size + (c - 2)] : null;
      const up1 = r > 0 ? board[(r - 1) * size + c] : null;
      const up2 = r > 1 ? board[(r - 2) * size + c] : null;
      const leftColor1 = left1?.blocked ? null : left1?.color;
      const leftColor2 = left2?.blocked ? null : left2?.color;
      const upColor1 = up1?.blocked ? null : up1?.color;
      const upColor2 = up2?.blocked ? null : up2?.color;

      let guard = 0;
      while ((color === leftColor1 && color === leftColor2) || (color === upColor1 && color === upColor2)) {
        color = randColor(colorPool, [leftColor1, upColor1].filter(Boolean));
        guard += 1;
        if (guard > 10) break;
      }
      board[idx] = makeTile(color);
    }
  }
  return board;
}

function toIndex(r, c, size) {
  return r * size + c;
}

function getCoords(idx, size) {
  return { r: Math.floor(idx / size), c: idx % size };
}

function isAdjacent(a, b, size) {
  const ar = Math.floor(a / size);
  const ac = a % size;
  const br = Math.floor(b / size);
  const bc = b % size;
  return (Math.abs(ar - br) + Math.abs(ac - bc)) === 1;
}

function tileColor(tile) {
  if (!tile || tile.blocked) return null;
  return tile.color;
}

function findMatches(board, size) {
  const matched = new Set();
  let maxRun = 0;

  for (let r = 0; r < size; r += 1) {
    let runColor = null;
    let runStart = 0;
    let runLen = 0;
    for (let c = 0; c < size; c += 1) {
      const tile = board[toIndex(r, c, size)];
      const color = tileColor(tile);
      if (color && color === runColor) {
        runLen += 1;
      } else {
        if (runLen >= 3) {
          maxRun = Math.max(maxRun, runLen);
          for (let k = 0; k < runLen; k += 1) {
            matched.add(toIndex(r, runStart + k, size));
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
        matched.add(toIndex(r, runStart + k, size));
      }
    }
  }

  for (let c = 0; c < size; c += 1) {
    let runColor = null;
    let runStart = 0;
    let runLen = 0;
    for (let r = 0; r < size; r += 1) {
      const tile = board[toIndex(r, c, size)];
      const color = tileColor(tile);
      if (color && color === runColor) {
        runLen += 1;
      } else {
        if (runLen >= 3) {
          maxRun = Math.max(maxRun, runLen);
          for (let k = 0; k < runLen; k += 1) {
            matched.add(toIndex(runStart + k, c, size));
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
        matched.add(toIndex(runStart + k, c, size));
      }
    }
  }

  return { matched, maxRun };
}

function collapseBoard(board, config) {
  const size = config.size;
  const colorPool = COLOR_POOL.slice(0, Math.max(3, Math.min(COLOR_POOL.length, config.colors || DEFAULT_CONFIG.colors)));
  const next = board.slice();
  for (let c = 0; c < size; c += 1) {
    const col = [];
    const blockedRows = new Set();
    for (let r = size - 1; r >= 0; r -= 1) {
      const tile = next[toIndex(r, c, size)];
      if (tile?.blocked) {
        blockedRows.add(r);
        continue;
      }
      if (tile) col.push(tile);
    }
    let r = size - 1;
    for (const tile of col) {
      while (blockedRows.has(r)) r -= 1;
      next[toIndex(r, c, size)] = tile;
      r -= 1;
    }
    while (r >= 0) {
      if (blockedRows.has(r)) {
        r -= 1;
        continue;
      }
      next[toIndex(r, c, size)] = makeTile(randColor(colorPool));
      r -= 1;
    }
  }
  return next;
}

function hasAnyMoves(board, size) {
  for (let i = 0; i < board.length; i += 1) {
    const tile = board[i];
    if (tile?.blocked) continue;
    const { r, c } = getCoords(i, size);
    const right = c + 1 < size ? toIndex(r, c + 1, size) : null;
    const down = r + 1 < size ? toIndex(r + 1, c, size) : null;
    for (const j of [right, down]) {
      if (j == null) continue;
      if (board[j]?.blocked) continue;
      const swapped = swap(board, i, j);
      if (findMatches(swapped, size).matched.size > 0) return true;
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
  mode,
  readOnly
}) {
  const config = useMemo(() => {
    const next = { ...DEFAULT_CONFIG, ...(mode || {}) };
    next.size = Math.max(4, Math.min(8, Number(next.size || DEFAULT_CONFIG.size)));
    next.moves = Math.max(8, Math.min(30, Number(next.moves || DEFAULT_CONFIG.moves)));
    next.target = Math.max(60, Math.min(400, Number(next.target || DEFAULT_CONFIG.target)));
    next.colors = Math.max(4, Math.min(COLOR_POOL.length, Number(next.colors || DEFAULT_CONFIG.colors)));
    next.blocks = Math.max(0, Math.min(next.size * next.size - 1, Number(next.blocks || 0)));
    return next;
  }, [mode]);
  const [board, setBoard] = useState(() => createBoard(config));
  const [selected, setSelected] = useState(null);
  const [matched, setMatched] = useState([]);
  const [busy, setBusy] = useState(false);
  const [movesLeft, setMovesLeft] = useState(config.moves);
  const [score, setScore] = useState(0);
  const [comboFlash, setComboFlash] = useState("");
  const [shake, setShake] = useState(false);
  const [status, setStatus] = useState("playing");
  const [apiErr, setApiErr] = useState("");
  const [result, setResult] = useState(null);
  const [settling, setSettling] = useState(false);
  const maxMatchRef = useRef(0);
  const matchedSet = useMemo(() => new Set(matched), [matched]);

  const progress = Math.min(100, Math.round((score / config.target) * 100));
  const targetLeft = Math.max(0, config.target - score);

  const resetGame = useCallback(() => {
    const next = createBoard(config);
    setBoard(next);
    setSelected(null);
    setMatched([]);
    setBusy(false);
    setMovesLeft(config.moves);
    setScore(0);
    setComboFlash("");
    setShake(false);
    setStatus("playing");
    setApiErr("");
    setResult(null);
    setSettling(false);
    maxMatchRef.current = 0;
  }, [config]);

  useEffect(() => {
    if (!open) return;
    resetGame();
  }, [open, resetGame]);

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
    if (score >= config.target) setStatus("win");
    else if (movesLeft <= 0) setStatus("loss");
  }, [score, movesLeft, status, config]);

  async function resolveBoard(nextBoard) {
    let combo = 1;
    let current = nextBoard;
    let maxRunLocal = 0;
    // eslint-disable-next-line no-constant-condition -- intentional: resolve cascades until no matches
    while (true) {
      const { matched: m, maxRun } = findMatches(current, config.size);
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
      current = collapseBoard(cleared, config);
      setBoard(current);
      await sleep(120);
      combo += 1;
    }
    if (!hasAnyMoves(current, config.size)) {
      setShake(true);
      await sleep(200);
      setShake(false);
      const reshuffle = createBoard(config);
      setBoard(reshuffle);
    }
    setComboFlash("");
    return maxRunLocal;
  }

  async function handleSelect(idx) {
    if (busy || status !== "playing" || disabled || readOnly) return;
    if (board[idx]?.blocked) return;
    if (selected == null) {
      setSelected(idx);
      return;
    }
    if (selected === idx) {
      setSelected(null);
      return;
    }
    if (!isAdjacent(selected, idx, config.size)) {
      setSelected(idx);
      return;
    }
    if (board[selected]?.blocked || board[idx]?.blocked) return;

    setBusy(true);
    const swapped = swap(board, selected, idx);
    const { matched: m } = findMatches(swapped, config.size);
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
  const modeLabel = mode?.label || "Классика";

  return (
    <div className="match3-overlay">
      <div className="match3-panel">
        <div className="match3-head">
          <div>
            <div className="match3-title">Три в ряд</div>
            <div className="small">Режим: {modeLabel} • Вход: {entryLabel} • Награда: {rewardRange}</div>
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
        <div className="small arcade-game-hint">Target remaining: {targetLeft}</div>

        <div
          className={`match3-board${shake ? " shake" : ""}`}
          style={{ gridTemplateColumns: `repeat(${config.size}, minmax(0, 1fr))` }}
        >
          {board.map((tile, idx) => {
            const isSelected = selected === idx;
            const isMatched = matchedSet.has(idx);
            return (
              <button
                key={tile?.id || `empty_${idx}`}
                type="button"
                className={`match3-tile ${tile?.color || "empty"}${tile?.blocked ? " blocked" : ""}${isSelected ? " selected" : ""}${isMatched ? " matched" : ""}`}
                onClick={() => handleSelect(idx)}
                disabled={busy || status !== "playing" || disabled || readOnly || tile?.blocked}
                aria-label={`Tile ${idx + 1}${tile?.blocked ? " blocked" : ""}${tile?.color ? ` ${tile.color}` : ""}`}
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
