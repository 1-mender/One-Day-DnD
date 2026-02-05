import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { makeProof } from "../../lib/gameProof.js";

const LETTERS = "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЫЭЮЯ";
const RARE = new Set(["Ф", "Щ", "Ъ", "Э", "Ю", "Я"]);

function pickLetters(count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(LETTERS[Math.floor(Math.random() * LETTERS.length)]);
  }
  return out;
}

function normalizeWord(word) {
  return String(word || "").trim().toUpperCase();
}

export default function ScrabbleBlitzGame({
  open,
  onClose,
  onSubmitResult,
  disabled,
  entryCost = 0,
  rewardRange = "—",
  mode,
  readOnly
}) {
  const timeLimit = Number(mode?.timeLimit || 60);
  const rackSize = Number(mode?.rackSize || 7);
  const [rack, setRack] = useState([]);
  const [word, setWord] = useState("");
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [status, setStatus] = useState("playing");
  const [result, setResult] = useState(null);
  const [settling, setSettling] = useState(false);
  const [apiErr, setApiErr] = useState("");
  const endAtRef = useRef(0);

  const entryLabel = entryCost
    ? `${entryCost} ${entryCost === 1 ? "билет" : entryCost < 5 ? "билета" : "билетов"}`
    : "бесплатно";
  const modeLabel = mode?.label || "Классика";

  const available = useMemo(() => rack.join(" "), [rack]);

  const resetGame = useCallback(() => {
    setRack(pickLetters(rackSize));
    setWord("");
    setTimeLeft(timeLimit);
    setStatus("playing");
    setResult(null);
    setSettling(false);
    setApiErr("");
    endAtRef.current = Date.now() + timeLimit * 1000;
  }, [rackSize, timeLimit]);

  useEffect(() => {
    if (!open) return;
    resetGame();
  }, [open, resetGame]);

  useEffect(() => {
    if (!open || status !== "playing") return;
    const interval = setInterval(() => {
      const left = Math.max(0, (endAtRef.current - Date.now()) / 1000);
      setTimeLeft(left);
      if (left <= 0) setStatus("loss");
    }, 200);
    return () => clearInterval(interval);
  }, [open, status]);

  useEffect(() => {
    if (status === "playing") return;
    if (!onSubmitResult || settling || result) return;
    const normalized = normalizeWord(word);
    const hasRare = normalized.split("").some((l) => RARE.has(l));
    const performance = status === "win"
      ? (normalized.length >= 6 ? "long" : hasRare ? "rare" : "normal")
      : "normal";
    const payload = { word: normalized, rack };
    const proof = makeProof("", payload);
    setSettling(true);
    setApiErr("");
    onSubmitResult({ outcome: status, performance, payload, proof })
      .then((r) => setResult(r))
      .catch((e) => setApiErr(e?.message || String(e)))
      .finally(() => setSettling(false));
  }, [status, onSubmitResult, settling, result, word, rack]);

  function canFormWord(normalized) {
    if (normalized.length < 3) return false;
    const letters = rack.slice();
    for (const ch of normalized) {
      const idx = letters.indexOf(ch);
      if (idx === -1) return false;
      letters.splice(idx, 1);
    }
    return true;
  }

  function handleSubmit() {
    if (status !== "playing" || disabled || readOnly) return;
    const normalized = normalizeWord(word);
    if (!canFormWord(normalized)) {
      setStatus("loss");
      return;
    }
    setStatus("win");
  }

  if (!open) return null;

  return (
    <div className="scrabble-overlay">
      <div className="scrabble-panel">
        <div className="scrabble-head">
          <div>
            <div className="scrabble-title">Эрудит-блиц</div>
            <div className="small">Режим: {modeLabel} • Вход: {entryLabel} • Награда: {rewardRange}</div>
          </div>
          <button className="btn secondary" onClick={onClose}>Выйти</button>
        </div>

        <div className="scrabble-hud">
          <div className="hud-card">
            <div className="hud-label">Время</div>
            <div className="hud-value">{Math.ceil(timeLeft)}с</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">Буквы</div>
            <div className="hud-value">{rack.length}</div>
          </div>
        </div>

        <div className="scrabble-rack">{available}</div>

        <div className="scrabble-input">
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="Введи слово"
            disabled={disabled || readOnly || status !== "playing"}
          />
          <button className="btn" onClick={handleSubmit} disabled={disabled || readOnly || status !== "playing"}>
            Проверить
          </button>
        </div>

        {disabled ? <div className="badge off">Аркада закрыта DM</div> : null}
        {readOnly ? <div className="badge warn">Read-only: действия отключены</div> : null}

        {status !== "playing" ? (
          <div className={`scrabble-result ${status}`}>
            <div className="scrabble-result-title">{status === "win" ? "Победа!" : "Поражение"}</div>
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
