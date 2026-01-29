import React from "react";

export default function VintageShell({ children, layout = "single", pageClassName = "" }) {
  return (
    <div className="vintage-shell">
      <div className="vintage-book">
        <div className={`vintage-page ${pageClassName}`.trim()} data-layout={layout}>
          {children}
        </div>
      </div>
    </div>
  );
}
