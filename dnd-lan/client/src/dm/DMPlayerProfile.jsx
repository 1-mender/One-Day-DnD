import React from "react";
import { Save } from "lucide-react";
import { ErrorBanner, Skeleton } from "../foundation/primitives/index.js";
import DMPlayerProfileProfileTab from "./playerProfile/sections/DMPlayerProfileProfileTab.jsx";
import DMPlayerProfileRequestsTab from "./playerProfile/sections/DMPlayerProfileRequestsTab.jsx";
import { useDmPlayerProfileController } from "./playerProfile/useDmPlayerProfileController.js";

export default function DMPlayerProfile() {
  const controller = useDmPlayerProfileController();
  const {
    canSave,
    dirty,
    err,
    goBack,
    load,
    loading,
    player,
    playerId,
    players,
    openPlayerProfile,
    readOnly,
    save,
    setTab,
    showRequestsTab,
    tab,
    updatedLabel,
    playerRequestsAll,
    quickAccess
  } = controller;
  const pinnedPlayers = quickAccess?.pinnedItems || [];
  const recentPlayers = quickAccess?.recentItems || [];
  const isPinned = quickAccess?.isPinned || (() => false);
  const togglePinned = quickAccess?.togglePinned || (() => {});
  return (
    <div className="card taped no-stamp">
      <div className="row u-row-between-center">
        <div>
          <div className="u-title-xl">Профиль персонажа</div>
          <div className="small">
            Игрок: <b>{player?.displayName || `#${playerId}`}</b> • Обновлён: {updatedLabel}
            {dirty ? " • есть несохранённые изменения" : ""}
          </div>
          {player ? (
            <div className="small u-mt-6">
              {players.length ? `Игроков в партии: ${players.length}` : "Профиль игрока"}
            </div>
          ) : null}
        </div>
        <div className="row">
          <button className="btn secondary" onClick={goBack}>Назад</button>
          <button className={`btn secondary${isPinned(playerId) ? " is-active" : ""}`} onClick={() => togglePinned(playerId)}>
            {isPinned(playerId) ? "Убрать из закреплённых" : "Закрепить игрока"}
          </button>
          <button className="btn" onClick={save} disabled={!canSave}>
            <Save className="icon" aria-hidden="true" />Сохранить
          </button>
          {readOnly ? <div className="badge warn">Режим только чтения: изменения отключены</div> : null}
        </div>
      </div>
      {pinnedPlayers.length || recentPlayers.length ? (
        <div className="dm-quick-access u-mt-10">
          {pinnedPlayers.length ? (
            <div className="dm-quick-access-group">
              <div className="tf-section-kicker">Закреплённые</div>
              <div className="dm-quick-access-chips">
                {pinnedPlayers.map((item) => (
                  <button
                    key={`pin-${item.id}`}
                    type="button"
                    className={`dm-quick-access-chip is-pinned${item.id === playerId ? " is-active" : ""}`}
                    onClick={() => openPlayerProfile(item.id)}
                  >
                    {item.displayName || `#${item.id}`}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {recentPlayers.length ? (
            <div className="dm-quick-access-group">
              <div className="tf-section-kicker">Недавние</div>
              <div className="dm-quick-access-chips">
                {recentPlayers.map((item) => (
                  <button
                    key={`recent-${item.id}`}
                    type="button"
                    className={`dm-quick-access-chip${item.id === playerId ? " is-active" : ""}`}
                    onClick={() => openPlayerProfile(item.id)}
                  >
                    {item.displayName || `#${item.id}`}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <hr />

      <div className="row u-row-gap-8">
        <button className={`btn ${tab === "profile" ? "" : "secondary"}`} onClick={() => setTab("profile")}>
          Профиль
        </button>
        {showRequestsTab ? (
          <button className={`btn ${tab === "requests" ? "" : "secondary"}`} onClick={() => setTab("requests")}>
            Запросы {playerRequestsAll.length ? `(${playerRequestsAll.length})` : ""}
          </button>
        ) : null}
      </div>

      <div className="u-mt-12">
        <ErrorBanner message={err} onRetry={load} />

        {loading ? (
          <div className="list">
            <div className="item"><Skeleton h={120} w="100%" /></div>
            <div className="item"><Skeleton h={140} w="100%" /></div>
          </div>
        ) : tab === "requests" ? (
          <DMPlayerProfileRequestsTab controller={controller} />
        ) : (
          <DMPlayerProfileProfileTab controller={controller} />
        )}
      </div>
    </div>
  );
}
