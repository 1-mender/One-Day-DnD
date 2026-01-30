import React, { useEffect, useMemo, useState } from "react";
import { motion } from "@motionone/react";

export default function VintageShell({ children, layout = "single", pageClassName = "", pageKey = "" }) {
  const reduceMotion = usePrefersReducedMotion();
  const motionProps = useMemo(() => {
    if (reduceMotion) return {};
    return {
      initial: { opacity: 0, y: 14, scale: 0.992 },
      animate: { opacity: 1, y: 0, scale: 1 },
      transition: { duration: 0.45, easing: "ease-out" }
    };
  }, [reduceMotion]);

  const resolvedKey = pageKey || undefined;

  return (
    <div className="vintage-shell">
      <div className="vintage-book">
        <motion.div
          key={resolvedKey}
          className={`vintage-page ${pageClassName}`.trim()}
          data-layout={layout}
          {...motionProps}
        >
          {children}
        </motion.div>
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
