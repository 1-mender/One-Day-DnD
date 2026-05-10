import React from "react";

export default function ContainerGridSection({
  container,
  touchLiteMode,
  touchOptimized,
  hasItems,
  children,
}) {
  if (touchLiteMode && container.key !== "backpack") {
    return (
      <details className="inv-slot-zone tf-slot-zone touch-collapsed" data-container={container.key} open={hasItems}>
        <summary className="inv-slot-zone-head">
          <h4>{container.label}</h4>
          <span className="badge secondary">{hasItems ? "есть предметы" : "пусто"}</span>
        </summary>
        {children}
      </details>
    );
  }

  return (
    <section
      className={`inv-slot-zone tf-slot-zone${touchOptimized ? " touch-optimized" : ""}`.trim()}
      data-container={container.key}
    >
      <div className="inv-slot-zone-head">
        <h4>{container.label}</h4>
      </div>
      {children}
    </section>
  );
}
