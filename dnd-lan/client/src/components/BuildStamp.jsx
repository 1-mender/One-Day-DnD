import React from "react";

const BUILD_ID = "2026-02-03-01";

export default function BuildStamp() {
  if (typeof window === "undefined") return null;
  const sp = new URLSearchParams(window.location.search);
  if (sp.get("stamp") !== "1") return null;
  return (
    <div
      style={{
        position: "fixed",
        right: 8,
        bottom: 8,
        zIndex: 2000,
        padding: "6px 10px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.8)",
        border: "1px solid rgba(70,55,30,.35)",
        fontSize: 12,
        fontWeight: 800
      }}
    >
      BUILD {BUILD_ID}
    </div>
  );
}
