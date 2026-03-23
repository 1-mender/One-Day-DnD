import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useEffect, useRef, useState } from "react";
import { useLiteMode } from "../../../hooks/useLiteMode.js";

export function useInventoryResponsiveState(view, setView) {
  const lite = useLiteMode();
  const isNarrowScreen = useIsNarrowScreen();
  const [listRef] = useAutoAnimate({ duration: lite ? 0 : 200 });
  const [mobileStatsOpen, setMobileStatsOpen] = useState(false);
  const [mobileFavoritesOpen, setMobileFavoritesOpen] = useState(false);
  const mobileViewInitRef = useRef(false);

  useEffect(() => {
    if (!isNarrowScreen || mobileViewInitRef.current) return;
    mobileViewInitRef.current = true;
    if (view === "slots") setView("list");
  }, [isNarrowScreen, setView, view]);

  return {
    lite,
    isNarrowScreen,
    listRef,
    mobileStatsOpen,
    setMobileStatsOpen,
    mobileFavoritesOpen,
    setMobileFavoritesOpen,
  };
}

function useIsNarrowScreen() {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 720px)");
    const update = () => setNarrow(!!mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else if (mq.addListener) mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else if (mq.removeListener) mq.removeListener(update);
    };
  }, []);

  return narrow;
}
