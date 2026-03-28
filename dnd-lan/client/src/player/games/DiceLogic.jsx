import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api.js";
import ArcadeOverlay from "./ArcadeOverlay.jsx";

const DEFAULT_MODE = {
  key: "classic",
  label: "Классика",
  allowReroll: true,
  targetScore: 2,
  timeLimit: 40
};

const CATEGORY_LABELS = {
  high: "Ничего",
  pair: "Пара",
  two_pairs: "Две пары",
  three: "Тройка",
  straight: "Стрит",
  full_house: "Фулл-хаус",
  four: "Каре",
  five: "Покер"
};

const CATEGORY_SCORE = {
  high: 0,
  pair: 1,
  two_pairs: 2,
  three: 3,
  straight: 4,
  full_house: 5,
  four: 6,
  five: 7
};

const DIE_PIPS = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]]
};

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

function rollDice(seed, suffix) {
  const rng = makeRng(`${seed}:${suffix}`);
  return Array.from({ length: 5 }, () => 1 + Math.floor(rng() * 6));
}

function classifyDiceRoll(values) {
  const dice = Array.isArray(values) ? values.map((v) => Number(v)) : [];
  if (dice.length !== 5 || !dice.every((v) => Number.isInteger(v) && v >= 1 && v <= 6)) return "high";
  const counts = new Map();
  for (const value of dice) counts.set(value, (counts.get(value) || 0) + 1);
  const groups = Array.from(counts.values()).sort((a, b) => b - a);
  const sorted = dice.slice().sort((a, b) => a - b);
  const isStraight = sorted.every((value, index) => index === 0 || value === sorted[index - 1] + 1);

  if (groups[0] === 5) return "five";
  if (groups[0] === 4) return "four";
  if (groups[0] === 3 && groups[1] === 2) return "full_house";
  if (isStraight) return "straight";
  if (groups[0] === 3) return "three";
  if (groups[0] === 2 && groups[1] === 2) return "two_pairs";
  if (groups[0] === 2) return "pair";
  return "high";
}

function getCategoryLabel(category) {
  return CATEGORY_LABELS[String(category || "").toLowerCase()] || "Ничего";
}

function getCategoryScore(category) {
  return Number(CATEGORY_SCORE[String(category || "").toLowerCase()] || 0);
}

function requiredCategoryLabel(targetScore) {
  if (targetScore >= 4) return "Стрит или лучше";
  if (targetScore >= 2) return "Две пары или лучше";
  return "Пара или лучше";
}

function performanceLabel(score) {
  if (score >= 6) return "Элитный бросок";
  if (score >= 4) return "Сильный бросок";
  if (score >= 2) return "Рабочая комбинация";
  return "Слабый бросок";
}

function renderDiePips(value) {
  const points = DIE_PIPS[Number(value)] || [];
  return (
    <span className="dice-die-pips" aria-hidden="true">
      {points.map(([x, y], idx) => (
        <span key={`${value}_${idx}`} className={`dice-pip x${x} y${y}`} />
      ))}
    </span>
  );
}

export default function DiceLogicGame({
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
  const [seedProof, setSeedProof] = useState("");
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedErr, setSeedErr] = useState("");
  const [baseRoll, setBaseRoll] = useState([]);
  const [rerollMask, setRerollMask] = useState([0, 0, 0, 0, 0]);
  const [rerolled, setRerolled] = useState(false);
  const [timeLeft, setTimeLeft] = useState(modeConfig.timeLimit);
  const [status, setStatus] = useState("playing");
  const [result, setResult] = useState(null);
  const [settling, setSettling] = useState(false);
  const [apiErr, setApiErr] = useState("");
  const [rollFx, setRollFx] = useState(false);
  const [resultFx, setResultFx] = useState(false);
  const endAtRef = useRef(0);
  const submittedRef = useRef(false);
  const rollFxTimeoutRef = useRef(null);
  const resultFxTimeoutRef = useRef(null);

  const currentRoll = useMemo(() => {
    if (!seed || !baseRoll.length) return [];
    if (!rerolled) return baseRoll;
    const reroll = rollDice(seed, "reroll");
    return baseRoll.map((value, index) => (rerollMask[index] ? reroll[index] : value));
  }, [baseRoll, rerollMask, rerolled, seed]);

  const currentCategory = useMemo(() => classifyDiceRoll(currentRoll), [currentRoll]);
  const currentScore = useMemo(() => getCategoryScore(currentCategory), [currentCategory]);
  const meetsTarget = currentScore >= Number(modeConfig.targetScore || 0);
  const selectedCount = rerollMask.reduce((sum, value) => sum + Number(!!value), 0);
  const currentStage = !modeConfig.allowReroll
    ? "Один бросок"
    : rerolled
      ? "Финальный результат"
      : "Выбор для реролла";
  const stageHint = !modeConfig.allowReroll
    ? "Оцени выпавшую комбинацию и сразу зафиксируй её."
    : rerolled
      ? "Переброс уже потрачен. Осталось оценить итоговую комбинацию."
      : "Отметь кости, которые хочешь перебросить, чтобы улучшить комбинацию.";

  const entryLabel = entryCost
    ? `${entryCost} ${entryCost === 1 ? "билет" : entryCost < 5 ? "билета" : "билетов"}`
    : "бесплатно";

  const requestSeed = useCallback(async () => {
    setSeedBusy(true);
    setSeedErr("");
    try {
      const issued = await api.ticketsSeed("dice");
      const nextSeed = String(issued?.seed || "");
      const nextProof = String(issued?.proof || "");
      if (!nextSeed || !nextProof) throw new Error("seed_unavailable");
      setSeed(nextSeed);
      setSeedProof(nextProof);
    } catch {
      setSeed("");
      setSeedProof("");
      setBaseRoll([]);
      setSeedErr("Не удалось загрузить бросок. Попробуйте ещё раз.");
    } finally {
      setSeedBusy(false);
    }
  }, []);

  const triggerRollFx = useCallback((duration = 780) => {
    if (rollFxTimeoutRef.current) clearTimeout(rollFxTimeoutRef.current);
    setRollFx(true);
    rollFxTimeoutRef.current = setTimeout(() => {
      setRollFx(false);
      rollFxTimeoutRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    return () => {
      if (rollFxTimeoutRef.current) clearTimeout(rollFxTimeoutRef.current);
      if (resultFxTimeoutRef.current) clearTimeout(resultFxTimeoutRef.current);
    };
  }, []);

  const resetFromSeed = useCallback(() => {
    if (!seed) return;
    setBaseRoll(rollDice(seed, "roll1"));
    setRerollMask([0, 0, 0, 0, 0]);
    setRerolled(false);
    setTimeLeft(Number(modeConfig.timeLimit || DEFAULT_MODE.timeLimit));
    setStatus("playing");
    setResult(null);
    setSettling(false);
    setApiErr("");
    setResultFx(false);
    submittedRef.current = false;
    endAtRef.current = Date.now() + Number(modeConfig.timeLimit || DEFAULT_MODE.timeLimit) * 1000;
    triggerRollFx(860);
  }, [modeConfig.timeLimit, seed, triggerRollFx]);

  useEffect(() => {
    if (!open) return;
    requestSeed().catch(() => {});
  }, [open, requestSeed]);

  useEffect(() => {
    if (!open || !seed) return;
    resetFromSeed();
  }, [open, resetFromSeed, seed]);

  useEffect(() => {
    if (!open || status !== "playing") return;
    const interval = setInterval(() => {
      const left = Math.max(0, (endAtRef.current - Date.now()) / 1000);
      setTimeLeft(left);
      if (left <= 0) {
        setStatus(currentScore >= Number(modeConfig.targetScore || 0) ? "win" : "loss");
      }
    }, 300);
    return () => clearInterval(interval);
  }, [currentScore, modeConfig.targetScore, open, status]);

  useEffect(() => {
    if (status === "playing") return;
    if (resultFxTimeoutRef.current) clearTimeout(resultFxTimeoutRef.current);
    setResultFx(true);
    resultFxTimeoutRef.current = setTimeout(() => {
      setResultFx(false);
      resultFxTimeoutRef.current = null;
    }, 1100);
    if (!onSubmitResult || settling || result || submittedRef.current) return;
    const performance = status === "win"
      ? (currentScore >= 6 ? "elite" : currentScore >= 4 ? "smart" : "normal")
      : "normal";
    const payload = {
      modeKey: String(modeConfig.key || DEFAULT_MODE.key),
      targetScore: Number(modeConfig.targetScore || 0),
      rerollMask,
      usedReroll: rerolled,
      finalCategory: currentCategory
    };
    submittedRef.current = true;
    setSettling(true);
    setApiErr("");
    onSubmitResult({ outcome: status, performance, payload, seed, proof: seedProof })
      .then((r) => setResult(r))
      .catch((e) => {
        submittedRef.current = false;
        setApiErr(e?.message || String(e));
      })
      .finally(() => setSettling(false));
  }, [currentCategory, currentScore, modeConfig, onSubmitResult, rerollMask, rerolled, result, seed, seedProof, settling, status]);

  function toggleDie(index) {
    if (disabled || readOnly || status !== "playing" || seedBusy || rerolled || !modeConfig.allowReroll) return;
    setRerollMask((prev) => prev.map((value, idx) => (idx === index ? (value ? 0 : 1) : value)));
  }

  function applyReroll() {
    if (disabled || readOnly || status !== "playing" || seedBusy || rerolled || !modeConfig.allowReroll) return;
    if (!rerollMask.some(Boolean)) return;
    setRerolled(true);
    triggerRollFx();
  }

  function finalizeRoll() {
    if (disabled || readOnly || status !== "playing" || seedBusy || !seed || !seedProof) return;
    setStatus(meetsTarget ? "win" : "loss");
  }

  async function retrySettlement() {
    if (!onSubmitResult || settling) return;
    const performance = status === "win"
      ? (currentScore >= 6 ? "elite" : currentScore >= 4 ? "smart" : "normal")
      : "normal";
    const payload = {
      modeKey: String(modeConfig.key || DEFAULT_MODE.key),
      targetScore: Number(modeConfig.targetScore || 0),
      rerollMask,
      usedReroll: rerolled,
      finalCategory: currentCategory
    };
    setSettling(true);
    setApiErr("");
    submittedRef.current = true;
    try {
      const response = await onSubmitResult({ outcome: status, performance, payload, seed, proof: seedProof });
      setResult(response);
    } catch (e) {
      submittedRef.current = false;
      setApiErr(e?.message || String(e));
    } finally {
      setSettling(false);
    }
  }

  return (
    <ArcadeOverlay open={open} className="dice-overlay">
      <div className="dice-panel">
        <div className="dice-head">
          <div>
            <div className="dice-title">Кости и решение</div>
            <div className="small">Режим: {modeConfig.label || DEFAULT_MODE.label} • Вход: {entryLabel} • Награда: {rewardRange}</div>
          </div>
          <button className="btn secondary" onClick={onClose}>Выйти</button>
        </div>

        <div className="dice-brief">
          <div className="dice-stage-card">
            <div className="hud-label">Этап</div>
            <div className="dice-stage-title">{currentStage}</div>
            <div className="small">{stageHint}</div>
          </div>
          <div className={`dice-goal-card${meetsTarget ? " met" : ""}`}>
            <div className="hud-label">Цель раунда</div>
            <div className="dice-goal-line">{requiredCategoryLabel(modeConfig.targetScore)}</div>
            <div className="small">
              Сейчас: {getCategoryLabel(currentCategory)} • {performanceLabel(currentScore)}
            </div>
          </div>
        </div>

        <div className="dice-hud">
          <div className="hud-card">
            <div className="hud-label">Время</div>
            <div className="hud-value">{Math.ceil(timeLeft)}с</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">Цель</div>
            <div className="hud-value">{requiredCategoryLabel(modeConfig.targetScore)}</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">Комбинация</div>
            <div className="hud-value">{getCategoryLabel(currentCategory)}</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">Реролл</div>
            <div className="hud-value">
              {modeConfig.allowReroll ? (rerolled ? "Использован" : "Доступен") : "Нет"}
            </div>
          </div>
        </div>

        <div className={`dice-grid${rollFx ? " is-rolling" : ""}`} role="list" aria-label="Игровые кости">
          {currentRoll.map((value, index) => (
            <button
              key={`${seed || "dice"}_${index}_${value}`}
              type="button"
              className={`dice-die${rerollMask[index] ? " selected" : ""}${rerolled && rerollMask[index] ? " rerolled" : ""}${rollFx ? " rolling" : ""}`}
              style={{ "--dice-delay": `${index * 55}ms` }}
              onClick={() => toggleDie(index)}
              disabled={disabled || readOnly || status !== "playing" || seedBusy || rerolled || !modeConfig.allowReroll}
              aria-label={`Кость ${index + 1}: ${value}${rerollMask[index] ? ", выбрана для переброса" : ""}`}
            >
              {renderDiePips(value)}
              <span className="dice-die-value">{value}</span>
              {rerollMask[index] ? <span className="dice-die-tag">Реролл</span> : null}
            </button>
          ))}
        </div>

        <div className="small arcade-game-hint dice-inline-hint">
          {modeConfig.allowReroll && !rerolled
            ? `Выбери кости для переброса. Сейчас отмечено: ${selectedCount}.`
            : "Оцени итоговую комбинацию и зафиксируй результат."}
        </div>

        <div className="dice-category-strip">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <span
              key={key}
              className={`meta-chip${currentCategory === key ? " active" : ""}${getCategoryScore(key) >= Number(modeConfig.targetScore || 0) ? " is-target" : ""}${meetsTarget && currentCategory === key ? " met" : ""}`}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="dice-controls row" style={{ gap: 8, flexWrap: "wrap" }}>
          {modeConfig.allowReroll && !rerolled ? (
            <button className="btn secondary" onClick={applyReroll} disabled={disabled || readOnly || seedBusy || !selectedCount}>
              Перебросить выбранные
            </button>
          ) : null}
          <button className="btn" onClick={finalizeRoll} disabled={disabled || readOnly || seedBusy || !seed || !seedProof}>
            Зафиксировать
          </button>
        </div>

        {disabled ? <div className="badge off">Аркада закрыта DM</div> : null}
        {readOnly ? <div className="badge warn">Режим только чтения: действия отключены</div> : null}
        {seedBusy || rollFx ? <div className="badge warn">{seedBusy ? "Подготавливаю бросок..." : "Кубики катятся..."}</div> : null}
        {seedErr ? <div className="badge off">{seedErr}</div> : null}

        {status !== "playing" ? (
          <div className={`dice-result ${status}${resultFx ? " reveal" : ""}`}>
            <div className="dice-result-title">{status === "win" ? "Удачный бросок!" : "Комбинация не дотянула"}</div>
            <div className="dice-result-roll" aria-hidden="true">
              {currentRoll.map((value, index) => (
                <span key={`result_${index}_${value}`} className="dice-result-chip">
                  {value}
                </span>
              ))}
            </div>
            <div className="small">
              Итог: {currentRoll.join(" • ")} • {getCategoryLabel(currentCategory)}
            </div>
            {settling ? <div className="badge warn">Начисляю билеты...</div> : null}
            {apiErr ? (
              <>
                <div className="badge off">Ошибка начисления: {apiErr}</div>
                <button className="btn secondary" onClick={retrySettlement}>Повторить</button>
              </>
            ) : null}
            {result ? (
              <div className="badge ok">
                {result.outcome === "win" ? `+${result.reward}` : `-${result.penalty + result.entryCost}`} билетов
              </div>
            ) : null}
            <div className="row" style={{ gap: 8 }}>
              {result && !settling ? (
                <button className="btn" onClick={() => requestSeed().catch(() => {})} disabled={seedBusy}>
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
