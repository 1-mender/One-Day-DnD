import React, { Suspense, lazy } from "react";
import Modal from "../components/Modal.jsx";
import { t } from "../i18n/index.js";
import {
  formatDayKey,
  formatDurationMs,
  formatEntry,
  impactClass
} from "./arcade/domain/arcadeFormatters.js";
import {
  localizeOutcome,
  localizeTagValue
} from "./arcade/domain/arcadeLocalization.js";
import { useArcadeController } from "./arcade/useArcadeController.js";

const Match3Game = lazy(() => import("./games/Match3.jsx"));
const GuessCardGame = lazy(() => import("./games/GuessCard.jsx"));
const TicTacToeGame = lazy(() => import("./games/TicTacToe.jsx"));
const UnoMiniGame = lazy(() => import("./games/UnoMini.jsx"));
const ScrabbleBlitzGame = lazy(() => import("./games/ScrabbleBlitz.jsx"));

export default function Arcade() {
  const {
    lite,
    rules,
    loading,
    err,
    readOnly,
    activeGame,
    activeRules,
    activeMode,
    outcome,
    setOutcome,
    performance,
    setPerformance,
    busy,
    queueBusy,
    queueGame,
    setQueueGameKey,
    queueReadyGames,
    queueModes,
    queueModeKey,
    selectedModes,
    playErr,
    questUpdated,
    games,
    perfOptions,
    ticketsEnabled,
    balance,
    streak,
    dailyEarned,
    dailySpent,
    dailyCap,
    dailyQuest,
    questHistoryRows,
    lastGameKey,
    lastGameTitle,
    lastGameReason,
    showLastGame,
    queueState,
    matchHistory,
    openGame,
    closeGame,
    formatEntryValue,
    formatRewardValue,
    getUiText,
    getDisabledReason,
    getGameRemaining,
    setMode,
    formatGameModeLabel,
    handleQueueJoin,
    handleQueueCancel,
    handleRematch,
    handleMatchComplete,
    handlePlay,
    handleMatch3Submit,
    handleGuessSubmit,
    handleTttSubmit,
    handleUnoSubmit,
    handleScrabbleSubmit,
    arcadeMetrics,
  } = useArcadeController();

  return (
    <div className={`card taped arcade-shell${lite ? " page-lite arcade-lite" : ""}`.trim()}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="arcade-title">Fish • Зал мини-игр</div>
          <div className="small">Fish — аркада мини‑игр с билетами и наградами.</div>
          <div className="small">Сыграй, собери серию и обменяй билеты у DJO.</div>
        </div>
        <div className="ticket-bank">
          <div className="ticket-card">
            <div className="ticket-label">Билеты</div>
            <div className="ticket-value">{loading ? "…" : balance}</div>
          </div>
          <div className="ticket-meta small">
            Серия побед: {loading ? "…" : streak} • Сегодня: +{dailyEarned}{dailyCap ? `/${dailyCap}` : ""} • Потрачено: {dailySpent}
          </div>
        </div>
      </div>
      <div className="arcade-banner">
        <div className="banner-title">Азарт важнее скорости</div>
        <div className="small">
          Сложнее игра — выше награда. За серии побед дают бонус, но вход требует
          билеты.
        </div>
      </div>
      <div className="paper-note arcade-queue-note" style={{ marginTop: 10 }}>
        <div className="title">{t("arcade.quickMatchTitle", null, "Быстрый матч")}</div>
        <div className="small" style={{ marginTop: 6 }}>
          {t("arcade.quickMatchHint", null, "Очередь, реванш и короткая история матчей.")}
        </div>
        <div className="arcade-queue-row" style={{ marginTop: 8 }}>
          {queueState ? (
            <>
              <span className="badge warn">{t("arcade.inQueueLabel", null, "В очереди")}: {formatGameModeLabel(queueState.gameKey, queueState.modeKey)}</span>
              <span className="badge secondary">{t("arcade.waitLabel", null, "Ожидание")}: {formatDurationMs(queueState.waitMs)}</span>
              <button className="btn secondary" onClick={handleQueueCancel} disabled={queueBusy || readOnly}>
                {queueBusy ? "..." : t("arcade.cancelQueue", null, "Отменить очередь")}
              </button>
            </>
          ) : (
            <>
              <select
                value={queueGame?.key || ""}
                onChange={(e) => setQueueGameKey(e.target.value)}
                aria-label="Игра для очереди матчмейкинга"
                disabled={queueBusy || readOnly || !queueReadyGames.length}
              >
                {queueReadyGames.map((g) => (
                  <option key={`qm_${g.key}`} value={g.key}>{g.title}</option>
                ))}
              </select>
              <div className="arcade-modes">
                {queueModes.map((mode) => (
                  <button
                    key={`qm_mode_${mode.key}`}
                    type="button"
                    className={`mode-chip${queueModeKey === mode.key ? " active" : ""}`}
                    onClick={() => queueGame && setMode(queueGame.key, mode.key)}
                    disabled={queueBusy || readOnly}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <button
                className="btn secondary"
                onClick={handleQueueJoin}
                disabled={queueBusy || readOnly || !queueGame || !queueModeKey}
              >
                {queueBusy ? "..." : t("arcade.joinQueue", null, "Встать в очередь")}
              </button>
            </>
          )}
        </div>
        <div className="small arcade-queue-meta" style={{ marginTop: 8 }}>
          {t("arcade.winRate", null, "Винрейт")}: {Math.round(Number(arcadeMetrics?.winRate || 0) * 100)}%
          {" • "}
          {t("arcade.avgQueue", null, "Средняя очередь")}: {arcadeMetrics?.avgQueueWaitMs != null ? formatDurationMs(arcadeMetrics.avgQueueWaitMs) : "—"}
          {" • "}
          {t("arcade.matches", null, "Матчи")}: {Number(arcadeMetrics?.matches || 0)}
        </div>
        {matchHistory.length ? (
          <div className="arcade-queue-history" style={{ marginTop: 8 }}>
            {matchHistory.slice(0, 3).map((m) => (
              <div key={`hist_${m.matchId}`} className="arcade-queue-history-item">
                <span className="small">
                  {formatGameModeLabel(m.gameKey, m.modeKey)} • {m.status === "completed" ? localizeOutcome(m.result) : t("arcade.active", null, "идёт")} {m.opponentName ? `${t("arcade.vs", null, "против")} ${m.opponentName}` : ""}
                </span>
                {m.status === "completed" ? (
                  <button className="btn secondary" onClick={() => handleRematch(m.matchId)} disabled={queueBusy || readOnly}>
                    {t("arcade.rematch", null, "Реванш")}
                  </button>
                ) : (
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn secondary" onClick={() => handleMatchComplete(m.matchId, "win")} disabled={queueBusy || readOnly}>
                      {t("arcade.outcomeWin", null, "Победа")}
                    </button>
                    <button className="btn secondary" onClick={() => handleMatchComplete(m.matchId, "loss")} disabled={queueBusy || readOnly}>
                      {t("arcade.outcomeLoss", null, "Поражение")}
                    </button>
                    <button className="btn secondary" onClick={() => handleMatchComplete(m.matchId, "draw")} disabled={queueBusy || readOnly}>
                      {t("arcade.outcomeDraw", null, "Ничья")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {dailyQuest ? (
        <div className="paper-note arcade-note" style={{ marginTop: 10 }}>
          <div className="title">{t("arcade.dailyQuest", null, "Ежедневный квест")}</div>
          <div className="small" style={{ marginTop: 6 }}>
            {dailyQuest.title}: {dailyQuest.description}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <span className="badge">
              Прогресс: {dailyQuest.progress}/{dailyQuest.goal}
            </span>
            <span className="badge secondary">
              Награда: {dailyQuest.reward} билета
            </span>
            {questUpdated ? (
              <span className="badge ok">Обновлено</span>
            ) : null}
            {dailyQuest.completed ? (
              <span className={`badge ${dailyQuest.rewarded ? "ok" : "warn"}`}>
                {dailyQuest.rewarded ? "Выполнено" : "Готово к награде"}
              </span>
            ) : null}
          </div>
          {dailyQuest.rewarded && dailyQuest.rewardGranted != null ? (
            <div className="small" style={{ marginTop: 6 }}>
              Получено: {dailyQuest.rewardGranted}
            </div>
          ) : null}
          {questHistoryRows.length ? (
            <div className="small" style={{ marginTop: 8 }}>
              История: {questHistoryRows.map((r) => `${formatDayKey(r.dayKey)}${r.rewardGranted ? `(+${r.rewardGranted})` : ""}`).join(", ")}
            </div>
          ) : null}
        </div>
      ) : null}
      {!ticketsEnabled ? (
        <div className="badge off" style={{ marginTop: 8 }}>Аркада закрыта DM</div>
      ) : null}
      {err ? <div className="badge off" style={{ marginTop: 8 }}>Ошибка билетов: {err}</div> : null}
      {dailyQuest && dailyQuest.completed && !dailyQuest.rewarded ? (
        <div className="badge ok" style={{ marginTop: 8 }}>{t("arcade.dailyQuestReady", null, "Ежедневный квест: награда готова")}</div>
      ) : null}
      <hr />

      <div className="arcade-grid">
        {games.map((g) => {
          const rulesToShow = lite ? g.rules.slice(0, 2) : g.rules;
          const hasMoreRules = lite && g.rules.length > rulesToShow.length;
          const remaining = getGameRemaining(g.key);
          const disabledReason = getDisabledReason(g.key);
          const canPlay = !disabledReason;
          const difficultyLabel = localizeTagValue(getUiText(g.key, "difficulty", g.difficulty), "difficulty");
          const riskLabel = localizeTagValue(getUiText(g.key, "risk", g.risk), "risk");
          const timeLabel = localizeTagValue(getUiText(g.key, "time", g.time), "time");
          const modes = Array.isArray(g.modes) ? g.modes : [];
          const selectedModeKey = selectedModes[g.key] || modes[0]?.key || "";
          return rules?.games?.[g.key]?.enabled === false ? (
            <div key={g.key} className="item taped arcade-card disabled-card">
              <div className="arcade-head">
                <div className="arcade-card-title">{g.title}</div>
                <span className="badge off">Недоступно</span>
              </div>
              <div className="small arcade-blurb">{g.blurb}</div>
              <div className="rule-list">
                {rulesToShow.map((rule, idx) => (
                  <div key={`${g.key}_${idx}`} className="rule-line">{rule}</div>
                ))}
                {hasMoreRules ? (
                  <div className="rule-more small">+ ещё {g.rules.length - rulesToShow.length}</div>
                ) : null}
              </div>
              <div className="row arcade-actions" style={{ justifyContent: "space-between" }}>
                <span className="ticket-pill">{formatRewardValue(g.key, "—")}</span>
                <button className="btn secondary" disabled>Недоступно</button>
              </div>
            </div>
          ) : (
            <div key={g.key} className="item taped arcade-card">
              <div className="arcade-head">
                <div className="arcade-card-title">{g.title}</div>
                <span
                  className={`badge badge-impact ${impactClass(difficultyLabel)}`}
                  title={`Сложность: ${difficultyLabel}`}
                >
                  {difficultyLabel}
                </span>
              </div>
              <div className="small arcade-blurb">{g.blurb}</div>
              <div className="arcade-meta">
                <span className="meta-chip" title={`Время: ${timeLabel}`}>Время: {timeLabel}</span>
                <span className="meta-chip" title={`Риск: ${riskLabel}`}>Риск: {riskLabel}</span>
                <span className="meta-chip">{formatEntryValue(g.key, 0)}</span>
                {remaining ? (
                  <span className="meta-chip">Попытки: {remaining.used}/{remaining.lim}</span>
                ) : null}
                {remaining ? (
                  <span className="meta-chip">Осталось: {remaining.left}</span>
                ) : null}
              </div>
              {modes.length > 1 ? (
                <div className="arcade-modes">
                  {modes.map((mode) => (
                    <button
                      key={`${g.key}_${mode.key}`}
                      type="button"
                      className={`mode-chip${selectedModeKey === mode.key ? " active" : ""}`}
                      onClick={() => setMode(g.key, mode.key)}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="rule-list">
                {rulesToShow.map((rule, idx) => (
                  <div key={`${g.key}_${idx}`} className="rule-line">{rule}</div>
                ))}
                {hasMoreRules ? (
                  <div className="rule-more small">+ ещё {g.rules.length - rulesToShow.length}</div>
                ) : null}
              </div>
              <div className="row arcade-actions" style={{ justifyContent: "space-between" }}>
                <span className="ticket-pill">{formatRewardValue(g.key, "—")}</span>
                <button
                  className="btn secondary"
                  disabled={!canPlay}
                  onClick={() => openGame(g.key)}
                >
                  Играть
                </button>
              </div>
              {!canPlay && disabledReason ? (
                <div className="small" style={{ marginTop: 6 }}>{disabledReason}</div>
              ) : null}
            </div>
          );
        })}
      </div>

      {showLastGame ? (
        <div className="row" style={{ marginTop: 10 }}>
          <button
            className="btn secondary"
            onClick={() => openGame(lastGameKey)}
            disabled={!!lastGameReason}
            title={lastGameReason || ""}
          >
            Последняя игра: {lastGameTitle}
          </button>
        </div>
      ) : null}


      <div className="paper-note arcade-note" style={{ marginTop: 12 }}>
        <div className="title">Правила билетов</div>
        <div className="small" style={{ marginTop: 6 }}>
          Билеты не копятся бесконечно: мастер может ограничить дневной лимит и
          выдавать бонусы за серию побед. Вход в сложные режимы стоит билеты, поэтому
          риск всегда осознанный.
        </div>
      </div>

      {activeGame?.key === "match3" ? (
        <Suspense fallback={renderGameFallback(activeGame?.title || "Три в ряд", closeGame)}>
          <Match3Game
            open={!!activeGame}
            onClose={closeGame}
            onSubmitResult={handleMatch3Submit}
            disabled={!ticketsEnabled || rules?.games?.match3?.enabled === false}
            entryCost={Number(rules?.games?.match3?.entryCost || 0)}
            rewardRange={
              rules?.games?.match3
                ? `${rules.games.match3.rewardMin}-${rules.games.match3.rewardMax} билетов`
                : "-"
            }
            mode={activeMode}
            readOnly={readOnly}
          />
        </Suspense>
      ) : activeGame?.key === "guess" ? (
        <Suspense fallback={renderGameFallback(activeGame?.title || "Угадай карту", closeGame)}>
          <GuessCardGame
            open={!!activeGame}
            onClose={closeGame}
            onSubmitResult={handleGuessSubmit}
            disabled={!ticketsEnabled || rules?.games?.guess?.enabled === false}
            entryCost={Number(rules?.games?.guess?.entryCost || 0)}
            rewardRange={
              rules?.games?.guess
                ? `${rules.games.guess.rewardMin}-${rules.games.guess.rewardMax} билетов`
                : "-"
            }
            mode={activeMode}
            readOnly={readOnly}
          />
        </Suspense>
      ) : activeGame?.key === "ttt" ? (
        <Suspense fallback={renderGameFallback(activeGame?.title || "Крестики-нолики", closeGame)}>
          <TicTacToeGame
            open={!!activeGame}
            onClose={closeGame}
            onSubmitResult={handleTttSubmit}
            disabled={!ticketsEnabled || rules?.games?.ttt?.enabled === false}
            entryCost={Number(rules?.games?.ttt?.entryCost || 0)}
            rewardRange={
              rules?.games?.ttt
                ? `${rules.games.ttt.rewardMin}-${rules.games.ttt.rewardMax} билетов`
                : "-"
            }
            mode={activeMode}
            readOnly={readOnly}
          />
        </Suspense>
      ) : activeGame?.key === "uno" ? (
        <Suspense fallback={renderGameFallback(activeGame?.title || "Уно-мини", closeGame)}>
          <UnoMiniGame
            open={!!activeGame}
            onClose={closeGame}
            onSubmitResult={handleUnoSubmit}
            disabled={!ticketsEnabled || rules?.games?.uno?.enabled === false}
            entryCost={Number(rules?.games?.uno?.entryCost || 0)}
            rewardRange={
              rules?.games?.uno
                ? `${rules.games.uno.rewardMin}-${rules.games.uno.rewardMax} билетов`
                : "-"
            }
            mode={activeMode}
            readOnly={readOnly}
          />
        </Suspense>
      ) : activeGame?.key === "scrabble" ? (
        <Suspense fallback={renderGameFallback(activeGame?.title || "Эрудит-блиц", closeGame)}>
          <ScrabbleBlitzGame
            open={!!activeGame}
            onClose={closeGame}
            onSubmitResult={handleScrabbleSubmit}
            disabled={!ticketsEnabled || rules?.games?.scrabble?.enabled === false}
            entryCost={Number(rules?.games?.scrabble?.entryCost || 0)}
            rewardRange={
              rules?.games?.scrabble
                ? `${rules.games.scrabble.rewardMin}-${rules.games.scrabble.rewardMax} билетов`
                : "-"
            }
            mode={activeMode}
            readOnly={readOnly}
          />
        </Suspense>
      ) : (
        <Modal
          open={!!activeGame}
          title={activeGame ? t("arcade.gameTitle", null, `Игра: ${activeGame.title}`) : ""}
          onClose={closeGame}
        >
          <div className="list arcade-play-modal">
            <div className="small note-hint">
              {activeRules
                ? t("arcade.entryReward", null, `${formatEntry(activeRules.entryCost)} | Награда: ${activeRules.rewardMin}-${activeRules.rewardMax}`)
                : t("arcade.rulesUnavailable", null, "Правила недоступны")}
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className={`btn ${outcome === "win" ? "" : "secondary"}`} onClick={() => setOutcome("win")}>{t("arcade.outcomeWin", null, "Победа")}</button>
              <button className={`btn ${outcome === "loss" ? "" : "secondary"}`} onClick={() => setOutcome("loss")}>{t("arcade.outcomeLoss", null, "Поражение")}</button>
            </div>
            {outcome === "win" ? (
              <div className="list">
                <div className="small">{t("arcade.performance", null, "Качество выполнения:")}</div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {perfOptions.map((opt) => (
                    <button
                      key={opt.key}
                      className={`btn ${performance === opt.key ? "" : "secondary"}`}
                      onClick={() => setPerformance(opt.key)}
                    >
                      {opt.label} x{opt.multiplier}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="small">{t("arcade.lossPenaltyHint", null, "При поражении списывается вход и штраф.")}</div>
            )}
            {playErr ? <div className="badge off">Ошибка: {playErr}</div> : null}
            <button className="btn" disabled={busy || readOnly} onClick={handlePlay}>
              {busy ? t("arcade.submitting", null, "Отправка...") : t("arcade.submitResult", null, "Отправить результат")}
            </button>
            {readOnly ? <div className="small">Режим только чтения: действия отключены.</div> : null}
          </div>
        </Modal>
      )}
    </div>
  );
}

function renderGameFallback(title, onClose) {
  return (
    <Modal open title={title ? t("arcade.gameTitle", null, `Игра: ${title}`) : t("arcade.game", null, "Игра")} onClose={onClose}>
      <div className="small">{t("arcade.loadingGame", null, "Загрузка игры...")}</div>
    </Modal>
  );
}
