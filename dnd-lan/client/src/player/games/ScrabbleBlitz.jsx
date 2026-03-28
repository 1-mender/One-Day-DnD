import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api.js";
import ArcadeOverlay from "./ArcadeOverlay.jsx";

const LETTERS = "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЭЮЯ";
const RARE = new Set(["Ф", "Щ", "Ъ", "Э", "Ю", "Я"]);

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

function buildSeededRack(seed, rackSize) {
  const size = Number(rackSize || 0);
  if (!seed || size < 3) return [];
  const rng = makeRng(`${seed}:scrabble:${size}`);
  return Array.from({ length: size }, () => LETTERS[Math.floor(rng() * LETTERS.length)]);
}

function normalizeWord(word) {
  return String(word || "").trim().toUpperCase();
}

function canFormWordFromRack(normalizedWord, rack) {
  if (normalizedWord.length < 3) return false;
  const letters = rack.slice();
  for (const ch of normalizedWord) {
    const idx = letters.indexOf(ch);
    if (idx === -1) return false;
    letters.splice(idx, 1);
  }
  return true;
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
  const [seed, setSeed] = useState("");
  const [seedProof, setSeedProof] = useState("");
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedErr, setSeedErr] = useState("");
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
  const modeKey = String(mode?.key || "normal");

  const normalizedWord = useMemo(() => normalizeWord(word), [word]);
  const isWordPlayable = useMemo(() => canFormWordFromRack(normalizedWord, rack), [normalizedWord, rack]);

  const requestSeed = useCallback(async () => {
    setSeedBusy(true);
    setSeedErr("");
    try {
      const issued = await api.ticketsSeed("scrabble");
      const nextSeed = String(issued?.seed || "");
      const nextProof = String(issued?.proof || "");
      if (!nextSeed || !nextProof) throw new Error("seed_unavailable");
      setSeed(nextSeed);
      setSeedProof(nextProof);
    } catch {
      setSeed("");
      setSeedProof("");
      setRack([]);
      setSeedErr("Не удалось загрузить буквы раунда. Попробуйте ещё раз.");
    } finally {
      setSeedBusy(false);
    }
  }, []);

  const resetGame = useCallback(() => {
    if (!seed) return;
    setRack(buildSeededRack(seed, rackSize));
    setWord("");
    setTimeLeft(timeLimit);
    setStatus("playing");
    setResult(null);
    setSettling(false);
    setApiErr("");
    setSeedErr("");
    endAtRef.current = Date.now() + timeLimit * 1000;
  }, [rackSize, seed, timeLimit]);

  useEffect(() => {
    if (!open) return;
    requestSeed().catch(() => {});
  }, [open, requestSeed]);

  useEffect(() => {
    if (!open || !seed) return;
    resetGame();
  }, [open, resetGame, seed]);

  useEffect(() => {
    if (!open || status !== "playing") return;
    const interval = setInterval(() => {
      const left = Math.max(0, (endAtRef.current - Date.now()) / 1000);
      setTimeLeft(left);
      if (left <= 0) setStatus("loss");
    }, 300);
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
    const payload = { modeKey, word: normalized };
    setSettling(true);
    setApiErr("");
    onSubmitResult({ outcome: status, performance, payload, seed, proof: seedProof })
      .then((r) => setResult(r))
      .catch((e) => setApiErr(e?.message || String(e)))
      .finally(() => setSettling(false));
  }, [status, onSubmitResult, settling, result, word, rack, modeKey, seed, seedProof]);

  function handleSubmit() {
    if (status !== "playing" || disabled || readOnly || seedBusy || !seed || !seedProof) return;
    if (!isWordPlayable) {
      setStatus("loss");
      return;
    }
    setStatus("win");
  }

  return (
    <ArcadeOverlay open={open} className="scrabble-overlay">
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

        <div className="scrabble-rack" role="list" aria-label="Набор букв">
          {rack.map((letter, idx) => (
            <span key={`${letter}-${idx}`} className="scrabble-tile" role="listitem">{letter}</span>
          ))}
        </div>
        <div className={`small scrabble-word-state ${normalizedWord ? (isWordPlayable ? "ok" : "bad") : ""}`}>
          {normalizedWord
            ? (isWordPlayable ? "Слово можно составить" : "Слово должно состоять из этих букв и быть не короче 3 символов")
            : "Собери слово из доступных букв"}
        </div>

        <div className="scrabble-input">
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="Введи слово"
            aria-label="Слово из доступных букв"
            disabled={disabled || readOnly || seedBusy || !seed || !seedProof || status !== "playing"}
          />
          <button className="btn" onClick={handleSubmit} disabled={disabled || readOnly || seedBusy || !seed || !seedProof || status !== "playing" || !normalizedWord}>
            Проверить
          </button>
        </div>

        {disabled ? <div className="badge off">Аркада закрыта DM</div> : null}
        {readOnly ? <div className="badge warn">Режим только чтения: действия отключены</div> : null}
        {seedBusy ? <div className="badge warn">Подготавливаю набор букв...</div> : null}
        {seedErr ? <div className="badge off">{seedErr}</div> : null}

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
                <button className="btn" onClick={() => requestSeed().catch(() => {})} disabled={seedBusy}>Сыграть снова</button>
              ) : null}
              <button className="btn secondary" onClick={onClose}>Закрыть</button>
            </div>
          </div>
        ) : null}
      </div>
    </ArcadeOverlay>
  );
}
