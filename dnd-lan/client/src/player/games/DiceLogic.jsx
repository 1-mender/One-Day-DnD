import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  onStartSession,
  onMoveSession,
  onFinishSession,
  disabled,
  entryCost = 0,
  rewardRange = "—",
  mode,
  readOnly
}) {
  const modeConfig = useMemo(() => ({ ...DEFAULT_MODE, ...(mode || {}) }), [mode]);
  const [sessionId, setSessionId] = useState("");
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionErr, setSessionErr] = useState("");
  const [currentRoll, setCurrentRoll] = useState([]);
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

  const applySnapshot = useCallback((snapshot) => {
    const state = snapshot?.state || {};
    setSessionId(String(snapshot?.sessionId || ""));
    setCurrentRoll(Array.isArray(state.currentRoll) ? state.currentRoll.map((value) => Number(value)) : []);
    setRerollMask(Array.isArray(state.rerollMask)
      ? state.rerollMask.map((value) => (value ? 1 : 0)).slice(0, 5)
      : [0, 0, 0, 0, 0]);
    setRerolled(state.rerolled === true);
    setTimeLeft(Math.max(0, Number(state.timeLeftMs || 0) / 1000));
    setStatus(String(state.status || "playing"));
    endAtRef.current = Date.now() + Math.max(0, Number(state.timeLeftMs || 0));
  }, []);

  const triggerRollFx = useCallback((duration = 780) => {
    if (rollFxTimeoutRef.current) clearTimeout(rollFxTimeoutRef.current);
    setRollFx(true);
    rollFxTimeoutRef.current = setTimeout(() => {
      setRollFx(false);
      rollFxTimeoutRef.current = null;
    }, duration);
  }, []);

  const startSession = useCallback(async () => {
    setSessionBusy(true);
    setSessionErr("");
    try {
      if (!onStartSession) throw new Error("session_api_unavailable");
      const response = await onStartSession("dice", { modeKey: String(modeConfig.key || DEFAULT_MODE.key) });
      const snapshot = response?.arcadeSession || null;
      if (!snapshot?.sessionId) throw new Error("session_unavailable");
      applySnapshot(snapshot);
      setResult(null);
      setSettling(false);
      setApiErr("");
      setResultFx(false);
      submittedRef.current = false;
      triggerRollFx(860);
    } catch {
      setSessionId("");
      setCurrentRoll([]);
      setRerollMask([0, 0, 0, 0, 0]);
      setRerolled(false);
      setStatus("playing");
      setResult(null);
      setSettling(false);
      setApiErr("");
      setResultFx(false);
      submittedRef.current = false;
      setSessionErr("Не удалось загрузить бросок. Попробуйте ещё раз.");
    } finally {
      setSessionBusy(false);
    }
  }, [applySnapshot, modeConfig.key, onStartSession, triggerRollFx]);

  useEffect(() => {
    return () => {
      if (rollFxTimeoutRef.current) clearTimeout(rollFxTimeoutRef.current);
      if (resultFxTimeoutRef.current) clearTimeout(resultFxTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    startSession().catch(() => {});
  }, [open, startSession]);

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
    if (settling || result || submittedRef.current || !sessionId) return;
    submittedRef.current = true;
    setSettling(true);
    setApiErr("");
    if (!onFinishSession) {
      submittedRef.current = false;
      setSettling(false);
      setApiErr("Серверный игровой протокол недоступен.");
      return;
    }
    onFinishSession(sessionId)
      .then((response) => {
        if (response?.arcadeSession) applySnapshot(response.arcadeSession);
        setResult(response?.result || response);
      })
      .catch((e) => {
        submittedRef.current = false;
        setApiErr(e?.message || String(e));
      })
      .finally(() => setSettling(false));
  }, [applySnapshot, onFinishSession, result, sessionId, settling, status]);

  function toggleDie(index) {
    if (disabled || readOnly || status !== "playing" || sessionBusy || rerolled || !modeConfig.allowReroll) return;
    setRerollMask((prev) => prev.map((value, idx) => (idx === index ? (value ? 0 : 1) : value)));
  }

  async function applyReroll() {
    if (disabled || readOnly || status !== "playing" || sessionBusy || rerolled || !modeConfig.allowReroll || !sessionId) return;
    if (!rerollMask.some(Boolean)) return;
    if (!onMoveSession) {
      setApiErr("Серверный игровой протокол недоступен.");
      return;
    }
    setSessionBusy(true);
    setApiErr("");
    triggerRollFx();
    try {
      const response = await onMoveSession(sessionId, { rerollMask });
      const snapshot = response?.arcadeSession || null;
      if (!snapshot) throw new Error("move_unavailable");
      applySnapshot(snapshot);
    } catch (e) {
      setApiErr(e?.message || String(e));
    } finally {
      setSessionBusy(false);
    }
  }

  function finalizeRoll() {
    if (disabled || readOnly || status !== "playing" || sessionBusy || !sessionId) return;
    setStatus(meetsTarget ? "win" : "loss");
  }

  async function retrySettlement() {
    if (settling || !sessionId) return;
    setSettling(true);
    setApiErr("");
    submittedRef.current = true;
    try {
      if (!onFinishSession) throw new Error("Серверный игровой протокол недоступен.");
      const response = await onFinishSession(sessionId);
      if (response?.arcadeSession) applySnapshot(response.arcadeSession);
      setResult(response?.result || response);
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
              key={`${sessionId || "dice"}_${index}_${value}`}
              type="button"
              className={`dice-die${rerollMask[index] ? " selected" : ""}${rerolled && rerollMask[index] ? " rerolled" : ""}${rollFx ? " rolling" : ""}`}
              style={{ "--dice-delay": `${index * 55}ms` }}
              onClick={() => toggleDie(index)}
              disabled={disabled || readOnly || status !== "playing" || sessionBusy || rerolled || !modeConfig.allowReroll}
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
            <button className="btn secondary" onClick={applyReroll} disabled={disabled || readOnly || sessionBusy || !selectedCount}>
              Перебросить выбранные
            </button>
          ) : null}
          <button className="btn" onClick={finalizeRoll} disabled={disabled || readOnly || sessionBusy || !sessionId}>
            Зафиксировать
          </button>
        </div>

        {disabled ? <div className="badge off">Аркада закрыта DM</div> : null}
        {readOnly ? <div className="badge warn">Режим только чтения: действия отключены</div> : null}
        {sessionBusy || rollFx ? <div className="badge warn">{sessionBusy ? "Подготавливаю бросок..." : "Кубики катятся..."}</div> : null}
        {sessionErr ? <div className="badge off">{sessionErr}</div> : null}

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
                <button className="btn" onClick={() => startSession().catch(() => {})} disabled={sessionBusy}>
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
