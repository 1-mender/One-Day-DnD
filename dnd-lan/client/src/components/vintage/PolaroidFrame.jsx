import React from "react";
import { getPolaroidImageProps } from "../../lib/imageSizing.js";

export default function PolaroidFrame({ src, alt = "", fallback = "?", className = "", style, innerStyle }) {
  const imageProps = getPolaroidImageProps(src, className);
  return (
    <div className={`polaroid ${className}`.trim()} style={style}>
      <div className="inner" style={innerStyle} data-has-image={src ? "true" : "false"}>
        {src ? (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            width={imageProps.width}
            height={imageProps.height}
            sizes={imageProps.sizes}
            srcSet={imageProps.srcSet}
          />
        ) : (
          <div className="fallback">{fallback}</div>
        )}
      </div>
    </div>
  );
}
