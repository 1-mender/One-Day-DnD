import React from "react";

export default function Skeleton({ h = 16, w = "100%", style, className = "" }) {
  return <div className={`fd-skeleton ${className}`.trim()} style={{ height: h, width: w, ...style }} />;
}
