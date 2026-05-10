import React from "react";
import MarkdownView from "../../markdown/MarkdownView.jsx";

export default function InventoryItemDescription({
  lite,
  descId,
  showFullDesc,
  description,
  descPreview,
  hasLongDesc,
  expanded,
  setExpanded,
}) {
  return (
    <div className={`inv-desc${lite ? " inv-desc-lite" : ""}`.trim()}>
      <div className="inv-desc-text" id={descId}>
        {showFullDesc ? (
          <MarkdownView source={description} />
        ) : (
          descPreview
        )}
      </div>
      {!lite && hasLongDesc ? (
        <button
          type="button"
          className="inv-desc-toggle"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded ? "true" : "false"}
          aria-controls={descId}
        >
          {expanded ? "Скрыть" : "Подробнее"}
        </button>
      ) : null}
    </div>
  );
}
