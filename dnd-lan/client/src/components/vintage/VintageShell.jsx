import React from "react";

export default function VintageShell({ children }) {
  return (
    <div className="vintage-shell">
      <div className="vintage-book">
        <div className="vintage-page">{children}</div>
      </div>
    </div>
  );
}
