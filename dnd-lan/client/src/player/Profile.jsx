import React from "react";
import { RefreshCcw } from "lucide-react";
import ErrorBanner from "../components/ui/ErrorBanner.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import { t } from "../i18n/index.js";
import ProfileContent from "./profile/sections/ProfileContent.jsx";
import ProfileEditModal from "./profile/sections/ProfileEditModal.jsx";
import ProfileRequestModal from "./profile/sections/ProfileRequestModal.jsx";
import { useProfileController } from "./profile/useProfileController.js";

export default function Profile() {
  const controller = useProfileController();
  const { err, load, loading, notCreated, profile, readOnly, updatedLabel } = controller;

  return (
    <div className="card profile-shell" aria-busy={loading ? "true" : "false"}>
      <div className="profile-header">
        <div className="profile-header-main">
          <div className="profile-title">Профиль персонажа</div>
          <div className="profile-meta small">
            {readOnly
              ? t("profile.readOnlyImpersonation", null, "только чтение (имперсонализация)")
              : t("profile.myProfile", null, "Твой профиль")}{" "}
            • Обновлён: {updatedLabel}
          </div>
        </div>
        <div className="profile-header-actions">
          <button className="btn secondary" onClick={load}>
            <RefreshCcw className="icon" aria-hidden="true" />Обновить
          </button>
        </div>
      </div>
      <hr />

      <ErrorBanner message={err} onRetry={load} />

      {loading ? (
        <div className="list">
          <div className="item"><Skeleton h={120} w="100%" /></div>
          <div className="item"><Skeleton h={140} w="100%" /></div>
        </div>
      ) : notCreated ? (
        <EmptyState title="Профиль ещё не создан" hint="DM должен создать профиль персонажа." />
      ) : profile ? (
        <ProfileContent controller={controller} />
      ) : null}

      <ProfileEditModal controller={controller} />
      <ProfileRequestModal controller={controller} />
    </div>
  );
}
