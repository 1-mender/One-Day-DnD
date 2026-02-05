import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api.js";
import { makeProof } from "../../lib/gameProof.js";

const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const SUIT_LABELS = {
  hearts: "Черви",
  diamonds: "Бубны",
  clubs: "Трефы",
  spades: "Пики"
};
const SUIT_SYMBOLS = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠"
};
const DEFAULT_MODE = {
  ranks: ["A", "K", "Q"],
  maxAttempts: 3,
  timeLimit: 40,
  hintCount: 3
};
const GRID_COLS = 4;

let cardId = 1;
const nextId = () => cardId++;

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

function shuffleWithSeed(arr, seed) {
  const rng = makeRng(seed);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildDeck(seed, ranks) {
  const cards = [];
  for (const suit of SUITS) {
    for (const rank of ranks) {
      cards.push({ id: nextId(), suit, rank, color: suit === "hearts" || suit === "diamonds" ? "red" : "black" });
    }
  }
  return shuffleWithSeed(cards, seed);
}

export default function GuessCardGame({
  open,
  onClose,
  onSubmitResult,
  disabled,
  entryCost = 0,
  rewardRange = "—",
  mode,
  readOnly
}) {
  const modeConfig = useMemo(() => ({ ...DEFAULT_MODE, ...(mode || {}) }), [mode]);
  const [seed, setSeed] = useState("");
  const [deck, setDeck] = useState([]);
  const [target, setTarget] = useState(null);
  const [revealed, setRevealed] = useState([]);
  const [attempt, setAttempt] = useState(1);
  const [timeLeft, setTimeLeft] = useState(modeConfig.timeLimit);
  const [status, setStatus] = useState("playing");
  const [busy, setBusy] = useState(false);
  const [missId, setMissId] = useState(null);
  const [result, setResult] = useState(null);
  const [settling, setSettling] = useState(false);
  const [apiErr, setApiErr] = useState("");
  const [winAttempt, setWinAttempt] = useState(1);
  const [pickHistory, setPickHistory] = useState([]);
  const endAtRef = useRef(0);

  const entryLabel = entryCost
    ? `${entryCost} ${entryCost === 1 ? "билет" : entryCost < 5 ? "билета" : "билетов"}`
    : "бесплатно";
  const modeLabel = mode?.label || "Классика";

  const hints = useMemo(() => {
    if (!target) return [];
    return [
      `Цвет: ${target.color === "red" ? "красный" : "чёрный"}`,
      `Масть: ${SUIT_LABELS[target.suit]}`,
      `Ранг: ${target.rank}`
    ];
  }, [target]);

  const resetGame = useCallback(() => {
    const next = buildDeck(seed || "fallback", modeConfig.ranks);
    setDeck(next);
    const rng = makeRng(`${seed || "fallback"}-target`);
    setTarget(next[Math.floor(rng() * next.length)]);
    setRevealed([]);
    setAttempt(1);
    setTimeLeft(modeConfig.timeLimit);
    setStatus("playing");
    setBusy(false);
    setMissId(null);
    setResult(null);
    setSettling(false);
    setApiErr("");
    setWinAttempt(1);
    setPickHistory([]);
    endAtRef.current = Date.now() + modeConfig.timeLimit * 1000;
  }, [modeConfig.ranks, modeConfig.timeLimit, seed]);

  useEffect(() => {
    if (!open) return;
    api.ticketsSeed("guess")
      .then((res) => setSeed(res?.seed || "fallback"))
      .catch(() => setSeed("fallback"));
  }, [open]);

  useEffect(() => {
    if (!open || !seed) return;
    resetGame();
  }, [open, seed, resetGame]);

  useEffect(() => {
    if (!open || status !== "playing") return;
    const interval = setInterval(() => {
      const left = Math.max(0, (endAtRef.current - Date.now()) / 1000);
      setTimeLeft(left);
      if (left <= 0) {
        setStatus("loss");
      }
    }, 200);
    return () => clearInterval(interval);
  }, [open, status]);

  useEffect(() => {
    if (status === "playing") return;
    if (!onSubmitResult || settling || result) return;
    const perf = status === "win"
      ? (winAttempt === 1 ? "first" : winAttempt === 2 ? "second" : "third")
      : "normal";
    const payload = {
      picks: pickHistory,
      ranks: modeConfig.ranks,
      maxAttempts: modeConfig.maxAttempts,
      outcome: status
    };
    const proof = makeProof(seed, payload);
    setSettling(true);
    setApiErr("");
    onSubmitResult({ outcome: status, performance: perf, payload, seed, proof })
      .then((r) => setResult(r))
      .catch((e) => setApiErr(e?.message || String(e)))
      .finally(() => setSettling(false));
  }, [status, onSubmitResult, settling, result, winAttempt, pickHistory, seed, modeConfig]);

  function isRevealed(id) {
    return revealed.includes(id);
  }

  function handlePick(card) {
    if (busy || status !== "playing" || disabled || readOnly) return;
    if (isRevealed(card.id)) return;

    setBusy(true);
    setRevealed((prev) => [...prev, card.id]);
    setPickHistory((prev) => [...prev, { suit: card.suit, rank: card.rank }]);

    if (card.id === target.id) {
      setWinAttempt(attempt);
      setStatus("win");
      setBusy(false);
      return;
    }

    setMissId(card.id);
    setTimeout(() => setMissId(null), 220);

    const nextAttempt = attempt + 1;
    setAttempt(nextAttempt);
    if (nextAttempt > modeConfig.maxAttempts) {
      setStatus("loss");
    }
    setBusy(false);
  }

  async function retrySettlement() {
    if (!onSubmitResult || settling) return;
    const perf = status === "win"
      ? (winAttempt === 1 ? "first" : winAttempt === 2 ? "second" : "third")
      : "normal";
    const payload = {
      picks: pickHistory,
      ranks: modeConfig.ranks,
      maxAttempts: modeConfig.maxAttempts,
      outcome: status
    };
    const proof = makeProof(seed, payload);
    setSettling(true);
    setApiErr("");
    try {
      const r = await onSubmitResult({ outcome: status, performance: perf, payload, seed, proof });
      setResult(r);
    } catch (e) {
      setApiErr(e?.message || String(e));
    } finally {
      setSettling(false);
    }
  }

  if (!open) return null;

  return (
    <div className="guess-overlay">
      <div className="guess-panel">
        <div className="guess-head">
          <div>
            <div className="guess-title">Угадай карту</div>
            <div className="small">Режим: {modeLabel} • Вход: {entryLabel} • Награда: {rewardRange}</div>
          </div>
          <button className="btn secondary" onClick={onClose}>Выйти</button>
        </div>

        <div className="guess-hud">
          <div className="hud-card">
            <div className="hud-label">Попытка</div>
            <div className="hud-value">{Math.min(attempt, modeConfig.maxAttempts)}/{modeConfig.maxAttempts}</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">Время</div>
            <div className="hud-value">{Math.ceil(timeLeft)}с</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">Осталось</div>
            <div className="hud-value">{deck.length - revealed.length}</div>
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

        <div
          className="guess-grid"
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
        >
          {deck.map((card) => {
            const flipped = isRevealed(card.id) || status !== "playing";
            return (
              <button
                key={card.id}
                type="button"
                className={`guess-card${flipped ? " flipped" : ""}${missId === card.id ? " miss" : ""}`}
                onClick={() => handlePick(card)}
                disabled={busy || status !== "playing" || disabled || readOnly}
              >
                <div className="guess-inner">
                  <div className="guess-face front">?</div>
                  <div className={`guess-face back ${card.color}`}>
                    <div className="guess-rank">{card.rank}</div>
                    <div className="guess-suit">{SUIT_SYMBOLS[card.suit]}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {disabled ? <div className="badge off">Аркада закрыта DM</div> : null}
        {readOnly ? <div className="badge warn">Read-only: действия отключены</div> : null}

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
