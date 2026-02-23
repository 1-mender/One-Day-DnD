import React from "react";

export default function StatusBanner({ tone = "info", children, className = "" }) {
  return <div className={`fd-status-banner ${tone} ${className}`.trim()}>{children}</div>;
}
