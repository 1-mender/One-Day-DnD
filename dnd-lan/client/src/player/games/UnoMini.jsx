import React, { useEffect, useState } from "react";
import { makeProof } from "../../lib/gameProof.js";

const COLORS = ["red", "green", "blue", "yellow"];
const NUMBERS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

function buildDeck() {
  const deck = [];
  for (const color of COLORS) {
    for (const number of NUMBERS) {
      deck.push({ color, value: number });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

function canPlay(card, top) {
  if (!card || !top) return false;
  return card.color === top.color || card.value === top.value;
}

export default function UnoMiniGame({
  open,
  onClose,
  onSubmitResult,
  disabled,
  entryCost = 0,
  rewardRange = "—",
  mode,
  readOnly
}) {
  const handSize = Number(mode?.handSize || 5);
  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [aiHand, setAiHand] = useState([]);
  const [topCard, setTopCard] = useState(null);
  const [playerDraws, setPlayerDraws] = useState(0);
  const [status, setStatus] = useState("playing");
  const [settling, setSettling] = useState(false);
  const [result, setResult] = useState(null);
  const [apiErr, setApiErr] = useState("");

  const entryLabel = entryCost
    ? `${entryCost} ${entryCost === 1 ? "билет" : entryCost < 5 ? "билета" : "билетов"}`
    : "бесплатно";
  const modeLabel = mode?.label || "Классика";

  function resetGame() {
    const nextDeck = buildDeck();
    const player = nextDeck.splice(0, handSize);
    const ai = nextDeck.splice(0, handSize);
    const top = nextDeck.shift();
    setDeck(nextDeck);
    setPlayerHand(player);
    setAiHand(ai);
    setTopCard(top);
    setPlayerDraws(0);
    setStatus("playing");
    setSettling(false);
    setResult(null);
    setApiErr("");
  }

  useEffect(() => {
    if (!open) return;
    resetGame();
  }, [open, handSize]);

  useEffect(() => {
    if (status === "playing") return;
    if (!onSubmitResult || settling || result) return;
    const performance = status === "win" && playerDraws === 0 ? "clean" : "normal";
    const payload = { playerDraws, handSize, outcome: status };
    const proof = makeProof("", payload);
    setSettling(true);
    setApiErr("");
    onSubmitResult({ outcome: status, performance, payload, proof })
      .then((r) => setResult(r))
      .catch((e) => setApiErr(e?.message || String(e)))
      .finally(() => setSettling(false));
  }, [status, onSubmitResult, settling, result, playerDraws, handSize]);

  function reshuffleIfNeeded(nextDeck) {
    if (nextDeck.length > 0) return nextDeck;
    return buildDeck().filter((card) => card.color !== topCard?.color || card.value !== topCard?.value);
  }

  function handlePlay(card, idx) {
    if (status !== "playing" || disabled || readOnly) return;
    if (!canPlay(card, topCard)) return;
    const nextHand = playerHand.slice();
    nextHand.splice(idx, 1);
    setPlayerHand(nextHand);
    setTopCard(card);
    if (nextHand.length === 0) {
      setStatus("win");
      return;
    }
    setTimeout(() => handleAiTurn(card, nextHand), 200);
  }

  function handleAiTurn(newTop, nextPlayerHand) {
    if (status !== "playing") return;
    let ai = aiHand.slice();
    const playableIdx = ai.findIndex((card) => canPlay(card, newTop));
    if (playableIdx >= 0) {
      const [card] = ai.splice(playableIdx, 1);
      setAiHand(ai);
      setTopCard(card);
      if (ai.length === 0) {
        setStatus("loss");
      }
      return;
    }
    let nextDeck = reshuffleIfNeeded(deck.slice());
    const drawn = nextDeck.shift();
    ai.push(drawn);
    setDeck(nextDeck);
    setAiHand(ai);
  }

  function handleDraw() {
    if (status !== "playing" || disabled || readOnly) return;
    let nextDeck = reshuffleIfNeeded(deck.slice());
    const drawn = nextDeck.shift();
    setDeck(nextDeck);
    setPlayerHand((prev) => [...prev, drawn]);
    setPlayerDraws((v) => v + 1);
    setTimeout(() => handleAiTurn(topCard, playerHand), 200);
  }

  if (!open) return null;

  return (
    <div className="uno-overlay">
      <div className="uno-panel">
        <div className="uno-head">
          <div>
            <div className="uno-title">Uno-мини</div>
            <div className="small">Режим: {modeLabel} • Вход: {entryLabel} • Награда: {rewardRange}</div>
          </div>
          <button className="btn secondary" onClick={onClose}>Выйти</button>
        </div>

        <div className="uno-hud">
          <div className="hud-card">
            <div className="hud-label">Карты</div>
            <div className="hud-value">{playerHand.length}</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">ИИ</div>
            <div className="hud-value">{aiHand.length}</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">Доборы</div>
            <div className="hud-value">{playerDraws}</div>
          </div>
        </div>

        <div className="uno-top-card">
          <span className={`uno-card ${topCard?.color || ""}`}>{topCard?.value || "?"}</span>
        </div>

        <div className="uno-hand">
          {playerHand.map((card, idx) => (
            <button
              key={`${card.color}-${card.value}-${idx}`}
              type="button"
              className={`uno-card ${card.color}${canPlay(card, topCard) ? " playable" : ""}`}
              onClick={() => handlePlay(card, idx)}
              disabled={!canPlay(card, topCard) || disabled || readOnly}
            >
              {card.value}
            </button>
          ))}
        </div>

        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn secondary" onClick={handleDraw} disabled={disabled || readOnly}>
            Добрать карту
          </button>
        </div>

        {disabled ? <div className="badge off">Аркада закрыта DM</div> : null}
        {readOnly ? <div className="badge warn">Read-only: действия отключены</div> : null}

        {status !== "playing" ? (
          <div className={`uno-result ${status}`}>
            <div className="uno-result-title">{status === "win" ? "Победа!" : "Поражение"}</div>
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
