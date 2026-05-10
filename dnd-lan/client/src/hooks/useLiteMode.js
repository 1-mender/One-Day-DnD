import { useEffect, useState } from "react";

export function useLiteMode() {
  const [lite, setLite] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const mqSmall = window.matchMedia?.("(max-width: 720px)");
    const mqReduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");

    const compute = () => {
      const classLite = root.classList.contains("theme-lite");
      const small = mqSmall?.matches || false;
      const reduce = mqReduce?.matches || false;

      let lowEnd = false;
      if (typeof navigator !== "undefined") {
        const lowMem = typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4;
        const lowCpu = typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4;
        const saveData = !!navigator.connection?.saveData;
        lowEnd = lowMem || lowCpu || saveData;
      }

      setLite(classLite || small || reduce || lowEnd);
    };

    compute();

    const onChange = () => compute();
    if (mqSmall?.addEventListener) mqSmall.addEventListener("change", onChange);
    else if (mqSmall?.addListener) mqSmall.addListener(onChange);
    if (mqReduce?.addEventListener) mqReduce.addEventListener("change", onChange);
    else if (mqReduce?.addListener) mqReduce.addListener(onChange);
    window.addEventListener("resize", onChange);

    return () => {
      if (mqSmall?.removeEventListener) mqSmall.removeEventListener("change", onChange);
      else if (mqSmall?.removeListener) mqSmall.removeListener(onChange);
      if (mqReduce?.removeEventListener) mqReduce.removeEventListener("change", onChange);
      else if (mqReduce?.removeListener) mqReduce.removeListener(onChange);
      window.removeEventListener("resize", onChange);
    };
  }, []);

  return lite;
}
