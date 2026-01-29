import React from "react";

export default function Skeleton({ h = 16, w = "100%", style }) {
  return <div className="skel" style={{ height: h, width: w, ...style }} />;
}
