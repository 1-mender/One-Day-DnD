import React from "react";
import { Save } from "lucide-react";
import ErrorBanner from "../components/ui/ErrorBanner.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
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
    readOnly,
    save,
    setTab,
    showRequestsTab,
    tab,
    updatedLabel,
    playerRequestsAll
  } = controller;

  return (
    <div className="card taped no-stamp">
      <div className="row u-row-between-center">
        <div>
          <div className="u-title-xl">Профиль персонажа</div>
          <div className="small">
            Игрок: <b>{player?.displayName || `#${playerId}`}</b> • Обновлён: {updatedLabel}
            {dirty ? " • есть несохранённые изменения" : ""}
          </div>
        </div>
        <div className="row">
          <button className="btn secondary" onClick={goBack}>Назад</button>
          <button className="btn" onClick={save} disabled={!canSave}>
            <Save className="icon" aria-hidden="true" />Сохранить
          </button>
          {readOnly ? <div className="badge warn">Режим только чтения: изменения отключены</div> : null}
        </div>
      </div>
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
