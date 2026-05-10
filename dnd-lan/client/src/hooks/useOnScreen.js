import { useEffect, useState, useRef } from "react";

// Returns [ref, isVisible]
export default function useOnScreen(options = { root: null, rootMargin: "0px", threshold: 0.1 }) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const root = options?.root ?? null;
  const rootMargin = options?.rootMargin ?? "0px";
  const threshold = options?.threshold ?? 0.1;
  const thresholdDep = Array.isArray(threshold) ? threshold.join(",") : String(threshold);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return () => {};
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setIsVisible(true);
        });
      },
      { root, rootMargin, threshold }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [root, rootMargin, thresholdDep, threshold]);

  return [ref, isVisible];
}
