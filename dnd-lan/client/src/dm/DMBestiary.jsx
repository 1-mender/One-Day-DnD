import React from "react";
import DMBestiaryDetailSection from "./bestiary/sections/DMBestiaryDetailSection.jsx";
import DMBestiaryEditorModal from "./bestiary/sections/DMBestiaryEditorModal.jsx";
import DMBestiaryListSection from "./bestiary/sections/DMBestiaryListSection.jsx";
import DMBestiaryManageSection from "./bestiary/sections/DMBestiaryManageSection.jsx";
import DMBestiaryReplaceConfirmModal from "./bestiary/sections/DMBestiaryReplaceConfirmModal.jsx";
import { useDMBestiaryController } from "./bestiary/useDMBestiaryController.js";

export default function DMBestiary() {
  const controller = useDMBestiaryController();
  const { selected } = controller;

  return (
    <>
      <div className="two-pane" data-detail={selected ? "1" : "0"}>
        <DMBestiaryListSection controller={controller} />
        <div className="pane pane-detail">
          <DMBestiaryDetailSection controller={controller} />
          <DMBestiaryManageSection controller={controller} />
        </div>
      </div>

      <DMBestiaryEditorModal controller={controller} />
      <DMBestiaryReplaceConfirmModal controller={controller} />
    </>
  );
}
