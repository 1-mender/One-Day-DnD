import React, { useEffect, useMemo, useRef, useState } from "react";

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
const RANKS = ["A", "K", "Q"];
const MAX_ATTEMPTS = 3;
const TIME_LIMIT = 40;
const GRID_COLS = 4;

let cardId = 1;
const nextId = () => cardId++;

function shuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildDeck() {
  const cards = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: nextId(), suit, rank, color: suit === "hearts" || suit === "diamonds" ? "red" : "black" });
    }
  }
  return shuffle(cards);
}

export default function GuessCardGame({
  open,
  onClose,
  onSubmitResult,
  disabled,
  entryCost = 0,
  rewardRange = "—",
  readOnly
}) {
  const [deck, setDeck] = useState([]);
  const [target, setTarget] = useState(null);
  const [revealed, setRevealed] = useState([]);
  const [attempt, setAttempt] = useState(1);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [status, setStatus] = useState("playing");
  const [busy, setBusy] = useState(false);
  const [missId, setMissId] = useState(null);
  const [result, setResult] = useState(null);
  const [settling, setSettling] = useState(false);
  const [apiErr, setApiErr] = useState("");
  const [winAttempt, setWinAttempt] = useState(1);
  const endAtRef = useRef(0);

  const entryLabel = entryCost
    ? `${entryCost} ${entryCost === 1 ? "билет" : entryCost < 5 ? "билета" : "билетов"}`
    : "бесплатно";

  const hints = useMemo(() => {
    if (!target) return [];
    return [
      `Цвет: ${target.color === "red" ? "красный" : "чёрный"}`,
      `Масть: ${SUIT_LABELS[target.suit]}`,
      `Ранг: ${target.rank}`
    ];
  }, [target]);

  function resetGame() {
    const next = buildDeck();
    setDeck(next);
    setTarget(next[Math.floor(Math.random() * next.length)]);
    setRevealed([]);
    setAttempt(1);
    setTimeLeft(TIME_LIMIT);
    setStatus("playing");
    setBusy(false);
    setMissId(null);
    setResult(null);
    setSettling(false);
    setApiErr("");
    setWinAttempt(1);
    endAtRef.current = Date.now() + TIME_LIMIT * 1000;
  }

  useEffect(() => {
    if (!open) return;
    resetGame();
  }, [open]);

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
    setSettling(true);
    setApiErr("");
    onSubmitResult({ outcome: status, performance: perf })
      .then((r) => setResult(r))
      .catch((e) => setApiErr(e?.message || String(e)))
      .finally(() => setSettling(false));
  }, [status, onSubmitResult, settling, result, winAttempt]);

  function isRevealed(id) {
    return revealed.includes(id);
  }

  function handlePick(card) {
    if (busy || status !== "playing" || disabled || readOnly) return;
    if (isRevealed(card.id)) return;

    setBusy(true);
    setRevealed((prev) => [...prev, card.id]);

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
    if (nextAttempt > MAX_ATTEMPTS) {
      setStatus("loss");
    }
    setBusy(false);
  }

  async function retrySettlement() {
    if (!onSubmitResult || settling) return;
    const perf = status === "win"
      ? (winAttempt === 1 ? "first" : winAttempt === 2 ? "second" : "third")
      : "normal";
    setSettling(true);
    setApiErr("");
    try {
      const r = await onSubmitResult({ outcome: status, performance: perf });
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
            <div className="small">Вход: {entryLabel} • Награда: {rewardRange}</div>
          </div>
          <button className="btn secondary" onClick={onClose}>Выйти</button>
        </div>

        <div className="guess-hud">
          <div className="hud-card">
            <div className="hud-label">Попытка</div>
            <div className="hud-value">{Math.min(attempt, MAX_ATTEMPTS)}/{MAX_ATTEMPTS}</div>
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
          <div className="guess-timer-bar" style={{ width: `${Math.max(0, (timeLeft / TIME_LIMIT) * 100)}%` }} />
        </div>

        <div className="guess-hints">
          {hints.slice(0, Math.min(attempt, MAX_ATTEMPTS)).map((h, idx) => (
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
