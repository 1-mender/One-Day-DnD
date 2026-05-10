import { useEffect, useRef, useState } from "react";

let swipeHintShown = false;

const SWIPE_START_PX = 16;
const SWIPE_ACTION_PX = 56;
const SWIPE_CANCEL_PX = 20;

export function useInventoryItemInteractions({
  itemId,
  hasActions,
  onToggleFavorite,
  readOnly,
}) {
  const [quickOpen, setQuickOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const isMobile = useIsMobile();
  const swipeEnabled = isMobile && hasActions;
  const longPressTimerRef = useRef(null);
  const pressStartRef = useRef({ x: 0, y: 0 });
  const swipeRef = useRef({ active: false, pointerId: null, startX: 0, startY: 0, swiping: false });

  useEffect(() => {
    setQuickOpen(false);
  }, [itemId]);

  useEffect(() => {
    if (!swipeEnabled || swipeHintShown || typeof window === "undefined") return;
    try {
      const seen = window.localStorage?.getItem("invSwipeHintSeen");
      if (seen) {
        swipeHintShown = true;
        return;
      }
      swipeHintShown = true;
      setShowHint(true);
      const timer = setTimeout(() => setShowHint(false), 1600);
      window.localStorage?.setItem("invSwipeHintSeen", "1");
      return () => clearTimeout(timer);
    } catch {
      swipeHintShown = true;
      setShowHint(true);
      const timer = setTimeout(() => setShowHint(false), 1600);
      return () => clearTimeout(timer);
    }
  }, [swipeEnabled]);

  const hapticTap = (duration = 10) => {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(duration);
      }
    } catch {
      // ignore
    }
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const clearSwipe = () => {
    swipeRef.current = { active: false, pointerId: null, startX: 0, startY: 0, swiping: false };
  };

  const isInteractiveTarget = (target) => {
    if (!target || typeof target.closest !== "function") return false;
    return !!target.closest("button, a, input, select, textarea, details, summary, label");
  };

  const handlePointerDown = (event) => {
    if (isInteractiveTarget(event.target)) return;
    if (event.pointerType !== "touch") return;
    if (event.currentTarget?.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    clearLongPress();
    pressStartRef.current = { x: event.clientX, y: event.clientY };
    longPressTimerRef.current = setTimeout(() => {
      setQuickOpen(true);
      hapticTap(8);
    }, 420);
    swipeRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      swiping: false
    };
  };

  const handlePointerMove = (event) => {
    const swipe = swipeRef.current;
    if (!swipe.active || swipe.pointerId !== event.pointerId) return;
    const dx = event.clientX - swipe.startX;
    const dy = event.clientY - swipe.startY;
    if (!swipe.swiping) {
      if (Math.abs(dx) > SWIPE_START_PX && Math.abs(dx) > Math.abs(dy)) {
        swipe.swiping = true;
        clearLongPress();
      } else if (Math.abs(dy) > SWIPE_CANCEL_PX) {
        clearSwipe();
      }
    }
  };

  const handlePointerEnd = (event) => {
    const swipe = swipeRef.current;
    if (!swipe.active || swipe.pointerId !== event.pointerId) {
      clearLongPress();
      return;
    }
    const dx = event.clientX - swipe.startX;
    const dy = event.clientY - swipe.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX > SWIPE_ACTION_PX && absX > absY * 1.2) {
      if (dx < 0 && hasActions) {
        setQuickOpen(true);
        hapticTap(8);
      } else if (dx > 0 && onToggleFavorite && !readOnly) {
        onToggleFavorite();
        hapticTap(6);
      }
    }
    clearSwipe();
    clearLongPress();
  };

  useEffect(() => () => clearLongPress(), []);

  return {
    isMobile,
    quickOpen,
    setQuickOpen,
    showHint,
    hapticTap,
    swipeEnabled,
    interactionHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerEnd,
      onPointerCancel: handlePointerEnd,
      onPointerLeave: handlePointerEnd,
    },
  };
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 720px)");
    const update = () => setIsMobile(!!mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else if (mq.addListener) mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else if (mq.removeListener) mq.removeListener(update);
    };
  }, []);

  return isMobile;
}
