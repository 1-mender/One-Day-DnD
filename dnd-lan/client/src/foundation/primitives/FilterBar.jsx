import React from "react";

export default function FilterBar({ children, className = "" }) {
  return <div className={`fd-filter-bar ${className}`.trim()}>{children}</div>;
}
