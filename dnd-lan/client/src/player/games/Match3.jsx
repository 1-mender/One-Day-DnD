import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api.js";
import ArcadeOverlay from "./ArcadeOverlay.jsx";
import {
  createMatch3Session,
  getMatch3Performance,
  normalizeMatch3Config,
  tryMatch3Move
} from "../../../../shared/match3Domain.js";

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
  const config = useMemo(() => normalizeMatch3Config(mode || {}), [mode]);
  const modeKey = String(config.key || mode?.key || "normal");

  const [seed, setSeed] = useState("");
  const [seedProof, setSeedProof] = useState("");
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedErr, setSeedErr] = useState("");
  const [board, setBoard] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [movesLeft, setMovesLeft] = useState(config.moves);
  const [score, setScore] = useState(0);
  const [comboFlash, setComboFlash] = useState("");
  const [shake, setShake] = useState(false);
  const [status, setStatus] = useState("playing");
  const [apiErr, setApiErr] = useState("");
  const [result, setResult] = useState(null);
  const [settling, setSettling] = useState(false);

  const sessionRef = useRef(null);
  const movesHistoryRef = useRef([]);
  const submittedRef = useRef(false);
  const comboTimerRef = useRef(null);

  const progress = Math.min(100, Math.round((score / config.target) * 100));
  const targetLeft = Math.max(0, config.target - score);

  const clearComboLater = useCallback(() => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => {
      setComboFlash("");
      comboTimerRef.current = null;
    }, 900);
  }, []);

  useEffect(() => () => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
  }, []);

  const requestSeed = useCallback(async () => {
    setSeedBusy(true);
    setSeedErr("");
    try {
      const issued = await api.ticketsSeed("match3");
      const nextSeed = String(issued?.seed || "");
      const nextProof = String(issued?.proof || "");
      if (!nextSeed || !nextProof) throw new Error("seed_unavailable");
      const session = createMatch3Session(nextSeed, config);
      sessionRef.current = session;
      movesHistoryRef.current = [];
      submittedRef.current = false;
      setSeed(nextSeed);
      setSeedProof(nextProof);
      setBoard(session.board.slice());
      setMovesLeft(config.moves);
      setScore(0);
      setSelected(null);
      setBusy(false);
      setComboFlash("");
      setShake(false);
      setStatus("playing");
      setApiErr("");
      setResult(null);
      setSettling(false);
    } catch {
      sessionRef.current = null;
      movesHistoryRef.current = [];
      submittedRef.current = false;
      setSeed("");
      setSeedProof("");
      setBoard([]);
      setMovesLeft(config.moves);
      setScore(0);
      setStatus("playing");
      setResult(null);
      setSettling(false);
      setApiErr("");
      setSeedErr("Не удалось загрузить раунд. Попробуйте ещё раз.");
    } finally {
      setSeedBusy(false);
    }
  }, [config]);

  const resetGame = useCallback(() => {
    setSelected(null);
    setBusy(false);
    setComboFlash("");
    setShake(false);
    requestSeed().catch(() => {});
  }, [requestSeed]);

  useEffect(() => {
    if (!open) return;
    resetGame();
  }, [open, resetGame]);

  useEffect(() => {
    if (status === "playing") return;
    if (!onSubmitResult || settling || result || submittedRef.current || !seed || !seedProof) return;
    const session = sessionRef.current;
    if (!session) return;
    const payload = {
      modeKey,
      moves: movesHistoryRef.current.slice()
    };
    const performance = getMatch3Performance(session, status);
    submittedRef.current = true;
    setSettling(true);
    setApiErr("");
    onSubmitResult({ outcome: status, performance, payload, seed, proof: seedProof })
      .then((response) => setResult(response))
      .catch((e) => {
        submittedRef.current = false;
        setApiErr(e?.message || String(e));
      })
      .finally(() => setSettling(false));
  }, [modeKey, onSubmitResult, result, seed, seedProof, settling, status]);

  async function handleSelect(idx) {
    if (busy || status !== "playing" || disabled || readOnly || seedBusy) return;
    const session = sessionRef.current;
    if (!session || board[idx]?.blocked) return;

    if (selected == null) {
      setSelected(idx);
      return;
    }
    if (selected === idx) {
      setSelected(null);
      return;
    }

    setBusy(true);
    const applied = tryMatch3Move(session, selected, idx);
    if (!applied.valid) {
      setShake(true);
      await new Promise((resolve) => setTimeout(resolve, 180));
      setShake(false);
      setSelected(null);
      setBusy(false);
      return;
    }

    movesHistoryRef.current = [...movesHistoryRef.current, { from: selected, to: idx }];
    setBoard(applied.board.slice());
    setScore(applied.score);
    setMovesLeft(Math.max(0, config.moves - applied.movesUsed));
    setStatus(applied.status);
    setSelected(null);

    if (applied.comboCount > 1) setComboFlash(`Комбо x${applied.comboCount}`);
    else if (applied.maxRunThisMove >= 4) setComboFlash(`Серия ${applied.maxRunThisMove}`);
    else setComboFlash("");
    if (applied.comboCount > 0 || applied.maxRunThisMove >= 4) clearComboLater();

    if (applied.reshuffled) {
      setShake(true);
      await new Promise((resolve) => setTimeout(resolve, 160));
      setShake(false);
    }
    setBusy(false);
  }

  async function retrySettlement() {
    if (!onSubmitResult || !seed || !seedProof) return;
    const session = sessionRef.current;
    if (!session) return;
    const payload = {
      modeKey,
      moves: movesHistoryRef.current.slice()
    };
    const performance = getMatch3Performance(session, status);
    submittedRef.current = true;
    setSettling(true);
    setApiErr("");
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

  const entryLabel = entryCost
    ? `${entryCost} ${entryCost === 1 ? "билет" : entryCost < 5 ? "билета" : "билетов"}`
    : "бесплатно";
  const modeLabel = mode?.label || "Классика";

  return (
    <ArcadeOverlay open={open} className="match3-overlay">
      <div className="match3-panel">
        <div className="match3-head">
          <div>
            <div className="match3-title">Три в ряд</div>
            <div className="small">Режим: {modeLabel} • Вход: {entryLabel} • Награда: {rewardRange}</div>
          </div>
          <button className="btn secondary" onClick={onClose} disabled={seedBusy}>Выйти</button>
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
        <div className="small arcade-game-hint">До цели осталось: {targetLeft}</div>
        {seedBusy ? <div className="badge warn">Подготавливаю расклад...</div> : null}
        {seedErr ? <div className="badge off">{seedErr}</div> : null}

        <div
          className={`match3-board${shake ? " shake" : ""}`}
          style={{ gridTemplateColumns: `repeat(${config.size}, minmax(0, 1fr))` }}
        >
          {board.map((tile, idx) => {
            const isSelected = selected === idx;
            return (
              <button
                key={tile?.id || `empty_${idx}`}
                type="button"
                className={`match3-tile ${tile?.color || "empty"}${tile?.blocked ? " blocked" : ""}${isSelected ? " selected" : ""}`}
                onClick={() => handleSelect(idx)}
                disabled={busy || status !== "playing" || disabled || readOnly || seedBusy || tile?.blocked}
                aria-label={`Клетка ${idx + 1}${tile?.blocked ? " заблокирована" : ""}${tile?.color ? ` ${tile.color}` : ""}`}
              >
                <span className="match3-gem" />
              </button>
            );
          })}
        </div>

        <div className="match3-footer small">
          Собери 3+ в ряд. Результат проверяется по истории ходов, а не по числам клиента.
        </div>

        {disabled ? <div className="badge off">Аркада закрыта DM</div> : null}
        {readOnly ? <div className="badge warn">Режим только чтения: действия отключены</div> : null}

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
                <button className="btn" onClick={resetGame} disabled={seedBusy}>Сыграть снова</button>
              ) : null}
              <button className="btn secondary" onClick={onClose}>Закрыть</button>
            </div>
          </div>
        ) : null}
      </div>
    </ArcadeOverlay>
  );
}
