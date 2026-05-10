const COLOR_POOL = ["ruby", "amber", "emerald", "sapphire", "amethyst", "bone", "topaz", "violet"];
export const SCORE_PER_TILE = 5;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeMatch3Config(mode = {}) {
  const next = { ...(mode || {}) };
  next.size = clamp(Number(next.size || 6), 4, 8);
  next.moves = clamp(Number(next.moves || 18), 8, 30);
  next.target = clamp(Number(next.target || 120), 60, 400);
  next.colors = clamp(Number(next.colors || 6), 4, COLOR_POOL.length);
  next.blocks = clamp(Number(next.blocks || 0), 0, next.size * next.size - 1);
  next.key = String(next.key || "normal");
  return next;
}

function makeRng(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return (h & 0xfffffff) / 0xfffffff;
  };
}

function nextColor(session, exclude = []) {
  const colorPool = COLOR_POOL.slice(0, session.config.colors);
  let color = colorPool[Math.floor(session.rng() * colorPool.length)];
  let guard = 0;
  while (exclude.includes(color) && guard < 16) {
    color = colorPool[Math.floor(session.rng() * colorPool.length)];
    guard += 1;
  }
  return color;
}

function makeTile(session, color, blocked = false) {
  const tile = { id: session.nextId++, color, blocked };
  if (blocked) tile.color = null;
  return tile;
}

function toIndex(r, c, size) {
  return r * size + c;
}

function isAdjacent(a, b, size) {
  const ar = Math.floor(a / size);
  const ac = a % size;
  const br = Math.floor(b / size);
  const bc = b % size;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

function tileColor(tile) {
  if (!tile || tile.blocked) return null;
  return tile.color;
}

function swap(board, a, b) {
  const next = board.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

function findMatches(board, size) {
  const matched = new Set();
  let maxRun = 0;

  for (let r = 0; r < size; r += 1) {
    let runColor = null;
    let runStart = 0;
    let runLen = 0;
    for (let c = 0; c < size; c += 1) {
      const color = tileColor(board[toIndex(r, c, size)]);
      if (color && color === runColor) {
        runLen += 1;
      } else {
        if (runLen >= 3) {
          maxRun = Math.max(maxRun, runLen);
          for (let k = 0; k < runLen; k += 1) matched.add(toIndex(r, runStart + k, size));
        }
        runColor = color;
        runStart = c;
        runLen = color ? 1 : 0;
      }
    }
    if (runLen >= 3) {
      maxRun = Math.max(maxRun, runLen);
      for (let k = 0; k < runLen; k += 1) matched.add(toIndex(r, runStart + k, size));
    }
  }

  for (let c = 0; c < size; c += 1) {
    let runColor = null;
    let runStart = 0;
    let runLen = 0;
    for (let r = 0; r < size; r += 1) {
      const color = tileColor(board[toIndex(r, c, size)]);
      if (color && color === runColor) {
        runLen += 1;
      } else {
        if (runLen >= 3) {
          maxRun = Math.max(maxRun, runLen);
          for (let k = 0; k < runLen; k += 1) matched.add(toIndex(runStart + k, c, size));
        }
        runColor = color;
        runStart = r;
        runLen = color ? 1 : 0;
      }
    }
    if (runLen >= 3) {
      maxRun = Math.max(maxRun, runLen);
      for (let k = 0; k < runLen; k += 1) matched.add(toIndex(runStart + k, c, size));
    }
  }

  return { matched, maxRun };
}

function collapseBoard(session, board) {
  const { size } = session.config;
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
      next[toIndex(r, c, size)] = makeTile(session, nextColor(session));
      r -= 1;
    }
  }

  return next;
}

function hasAnyMoves(board, size) {
  for (let idx = 0; idx < board.length; idx += 1) {
    const tile = board[idx];
    if (tile?.blocked) continue;
    const r = Math.floor(idx / size);
    const c = idx % size;
    const candidates = [];
    if (c + 1 < size) candidates.push(toIndex(r, c + 1, size));
    if (r + 1 < size) candidates.push(toIndex(r + 1, c, size));
    for (const target of candidates) {
      if (board[target]?.blocked) continue;
      const swapped = swap(board, idx, target);
      if (findMatches(swapped, size).matched.size > 0) return true;
    }
  }
  return false;
}

function createBoard(session) {
  const { size, blocks } = session.config;
  const board = new Array(size * size);
  const blockedPositions = new Set();
  while (blockedPositions.size < Math.min(blocks || 0, size * size)) {
    blockedPositions.add(Math.floor(session.rng() * size * size));
  }

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const idx = toIndex(r, c, size);
      if (blockedPositions.has(idx)) {
        board[idx] = makeTile(session, null, true);
        continue;
      }
      let color = nextColor(session);
      const left1 = c > 0 ? board[toIndex(r, c - 1, size)] : null;
      const left2 = c > 1 ? board[toIndex(r, c - 2, size)] : null;
      const up1 = r > 0 ? board[toIndex(r - 1, c, size)] : null;
      const up2 = r > 1 ? board[toIndex(r - 2, c, size)] : null;
      const leftColor1 = tileColor(left1);
      const leftColor2 = tileColor(left2);
      const upColor1 = tileColor(up1);
      const upColor2 = tileColor(up2);
      let guard = 0;
      while ((color === leftColor1 && color === leftColor2) || (color === upColor1 && color === upColor2)) {
        color = nextColor(session, [leftColor1, upColor1].filter(Boolean));
        guard += 1;
        if (guard > 16) break;
      }
      board[idx] = makeTile(session, color);
    }
  }

  return board;
}

function createPlayableBoard(session) {
  let guard = 0;
  let board = createBoard(session);
  while (!hasAnyMoves(board, session.config.size) && guard < 24) {
    board = createBoard(session);
    guard += 1;
  }
  return board;
}

export function createMatch3Session(seed, rawConfig = {}) {
  const config = normalizeMatch3Config(rawConfig);
  const session = {
    seed: String(seed || ""),
    config,
    rng: makeRng(`${seed}:match3`),
    nextId: 1,
    board: [],
    score: 0,
    maxRun: 0,
    movesUsed: 0
  };
  session.board = createPlayableBoard(session);
  return session;
}

export function findFirstMatch3ValidMove(session) {
  const { board, config } = session;
  for (let idx = 0; idx < board.length; idx += 1) {
    const tile = board[idx];
    if (tile?.blocked) continue;
    const r = Math.floor(idx / config.size);
    const c = idx % config.size;
    const candidates = [];
    if (c + 1 < config.size) candidates.push(toIndex(r, c + 1, config.size));
    if (r + 1 < config.size) candidates.push(toIndex(r + 1, c, config.size));
    for (const target of candidates) {
      if (board[target]?.blocked) continue;
      const swapped = swap(board, idx, target);
      if (findMatches(swapped, config.size).matched.size > 0) return { from: idx, to: target };
    }
  }
  return null;
}

export function getMatch3Status(session) {
  if (session.score >= session.config.target) return "win";
  if (session.movesUsed >= session.config.moves) return "loss";
  return "playing";
}

export function getMatch3Performance(session, outcome = getMatch3Status(session)) {
  if (outcome !== "win") return "normal";
  if (session.maxRun >= 5) return "combo5";
  if (session.maxRun >= 4) return "combo4";
  return "normal";
}

export function tryMatch3Move(session, from, to) {
  const { board, config } = session;
  if (!Number.isInteger(from) || !Number.isInteger(to)) return { valid: false, reason: "invalid_index" };
  if (from < 0 || to < 0 || from >= board.length || to >= board.length) return { valid: false, reason: "invalid_index" };
  if (!isAdjacent(from, to, config.size)) return { valid: false, reason: "not_adjacent" };
  if (board[from]?.blocked || board[to]?.blocked) return { valid: false, reason: "blocked" };

  const swapped = swap(board, from, to);
  if (findMatches(swapped, config.size).matched.size === 0) return { valid: false, reason: "no_match" };

  let current = swapped;
  let comboCount = 0;
  let maxRunThisMove = 0;
  let scoreDelta = 0;

  while (true) {
    const { matched, maxRun } = findMatches(current, config.size);
    if (matched.size === 0) break;
    comboCount += 1;
    maxRunThisMove = Math.max(maxRunThisMove, maxRun);
    const bonus = 1 + (comboCount - 1) * 0.2;
    scoreDelta += Math.round(matched.size * SCORE_PER_TILE * bonus);
    const cleared = current.map((tile, idx) => (matched.has(idx) ? null : tile));
    current = collapseBoard(session, cleared);
  }

  let reshuffled = false;
  if (!hasAnyMoves(current, config.size)) {
    current = createPlayableBoard(session);
    reshuffled = true;
  }

  session.board = current;
  session.score += scoreDelta;
  session.maxRun = Math.max(session.maxRun, maxRunThisMove);
  session.movesUsed += 1;

  return {
    valid: true,
    board: current,
    score: session.score,
    scoreDelta,
    maxRun: session.maxRun,
    maxRunThisMove,
    movesUsed: session.movesUsed,
    comboCount,
    reshuffled,
    status: getMatch3Status(session)
  };
}
