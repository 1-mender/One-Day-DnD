import React, { useEffect, useMemo, useState } from "react";

export default function VintageShell({ children, layout = "single", pageClassName = "", pageKey = "" }) {
  const reduceMotion = usePrefersReducedMotion();
  const pageClass = useMemo(() => {
    const base = `vintage-page ${pageClassName}`.trim();
    return reduceMotion ? base : `${base} page-enter`;
  }, [pageClassName, reduceMotion]);

  const resolvedKey = pageKey || undefined;

  return (
    <div className="vintage-shell">
      <div className="vintage-book">
        <div
          key={resolvedKey}
          className={pageClass}
          data-layout={layout}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduce(media.matches);
    onChange();
    if (media.addEventListener) {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  return reduce;
}
