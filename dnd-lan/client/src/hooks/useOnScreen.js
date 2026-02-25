import { useEffect, useState, useRef } from "react";

// Returns [ref, isVisible]
export default function useOnScreen(options = { root: null, rootMargin: "0px", threshold: 0.1 }) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return () => {};
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setIsVisible(true);
        });
      },
      options
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, options.root, options.rootMargin, options.threshold]);

  return [ref, isVisible];
}
