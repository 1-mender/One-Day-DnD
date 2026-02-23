import React, { useEffect, useState } from "react";
import { cycleUiVariant } from "../theme/uiVariant.js";

function getCurrentVariant() {
  if (typeof document === "undefined") return "";
  return document.documentElement.dataset.ui || "";
}

export default function UiVariantSwitcher() {
  const [variant, setVariant] = useState(getCurrentVariant);

  useEffect(() => {
    setVariant(getCurrentVariant());
    const onVariantChanged = (event) => {
      const next = String(event?.detail || getCurrentVariant() || "");
      setVariant(next);
    };
    window.addEventListener("ui-variant:changed", onVariantChanged);
    return () => window.removeEventListener("ui-variant:changed", onVariantChanged);
  }, []);

  return (
    <button
      type="button"
      className="btn secondary"
      onClick={cycleUiVariant}
      title="Сменить вариант UI"
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 9999,
        opacity: 0.92
      }}
    >
      {variant ? `UI: ${variant}` : "Сменить UI"}
    </button>
  );
}
