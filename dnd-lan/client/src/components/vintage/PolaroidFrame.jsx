import React from "react";

export default function PolaroidFrame({ src, alt = "", fallback = "?" }) {
  return (
    <div className="polaroid">
      <div className="inner">
        {src ? (
          <img src={src} alt={alt} />
        ) : (
          <div className="fallback">{fallback}</div>
        )}
      </div>
    </div>
  );
}
