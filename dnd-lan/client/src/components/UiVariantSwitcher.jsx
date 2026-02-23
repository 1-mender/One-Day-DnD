import React, { useEffect, useState } from "react";
import { cycleUiVariant, getUiVariant, setUiVariant, UI_VARIANTS } from "../theme/uiVariant.js";
import { t } from "../i18n/index.js";

export default function UiVariantSwitcher({ mode = "floating" }) {
  const [variant, setVariantState] = useState(getUiVariant);

  useEffect(() => {
    setVariantState(getUiVariant());
    const onVariantChanged = (event) => {
      const next = String(event?.detail || getUiVariant() || "");
      setVariantState(next);
    };
    window.addEventListener("ui-variant:changed", onVariantChanged);
    return () => window.removeEventListener("ui-variant:changed", onVariantChanged);
  }, []);

  if (mode === "inline") {
    return (
      <div className="ui-variant-panel">
        <div className="u-fw-800">{t("uiVariant.dmSettingsTitle")}</div>
        <div className="small">{t("uiVariant.dmSettingsHint")}</div>
        <div className="row u-row-gap-8 u-mt-10">
          {UI_VARIANTS.map((it) => (
            <button
              key={it}
              type="button"
              className={`btn ${variant === it ? "" : "secondary"}`.trim()}
              onClick={() => setUiVariant(it)}
              aria-pressed={variant === it ? "true" : "false"}
            >
              {it.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="btn secondary ui-variant-fab"
      onClick={cycleUiVariant}
      title={t("uiVariant.cycleTitle")}
    >
      {variant ? t("uiVariant.current", { variant }) : t("uiVariant.cycleLabel")}
    </button>
  );
}
