import React from "react";

export default function PolaroidFrame({ src, alt = "", fallback = "?", className = "", style, innerStyle }) {
  return (
    <div className={`polaroid ${className}`.trim()} style={style}>
      <div className="inner" style={innerStyle}>
        {src ? (
          <img src={src} alt={alt} />
        ) : (
          <div className="fallback">{fallback}</div>
        )}
      </div>
    </div>
  );
}
