import React, { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

function getBottomInsetPx() {
  if (typeof window === "undefined" || typeof document === "undefined") return 90;
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue("--bottom-nav-h");
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : 90;
}

function useViewportListHeight(ref, { minHeight = 280, maxHeight = 760, viewportBottomOffset = 20 }) {
  const [height, setHeight] = useState(minHeight);

  useEffect(() => {
    if (typeof window === "undefined") return () => {};

    const refresh = () => {
      const node = ref.current;
      if (!node) return;
      const viewportHeight = window.visualViewport?.height || window.innerHeight || 0;
      const rect = node.getBoundingClientRect();
      const available = Math.floor(viewportHeight - rect.top - getBottomInsetPx() - viewportBottomOffset);
      const next = Math.max(minHeight, Math.min(maxHeight, available || minHeight));
      setHeight((prev) => (prev === next ? prev : next));
    };

    const frameId = window.requestAnimationFrame(refresh);
    const visualViewport = window.visualViewport || null;
    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);
    visualViewport?.addEventListener("resize", refresh);
    visualViewport?.addEventListener("scroll", refresh);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
      visualViewport?.removeEventListener("resize", refresh);
      visualViewport?.removeEventListener("scroll", refresh);
    };
  }, [maxHeight, minHeight, ref, viewportBottomOffset]);

  return height;
}

export default function VirtualizedStack({
  className = "list",
  containerStyle,
  estimateSize = 120,
  getItemKey,
  items,
  maxHeight = 760,
  minHeight = 280,
  overscan = 8,
  renderItem,
  rowGap = 12,
  staticListRef = null,
  staticThreshold = 24,
  viewportBottomOffset = 20
}) {
  const list = Array.isArray(items) ? items : [];
  const scrollRef = useRef(null);
  const listHeight = useViewportListHeight(scrollRef, { minHeight, maxHeight, viewportBottomOffset });

  const rowVirtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan
  });

  if (list.length <= staticThreshold) {
    return (
      <div className={className} ref={staticListRef} style={containerStyle}>
        {list.map((item, index) => (
          <React.Fragment key={getItemKey?.(item, index) ?? index}>
            {renderItem(item, index)}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={className}
      style={{
        height: listHeight,
        overflowY: "auto",
        overscrollBehavior: "contain",
        ...containerStyle
      }}
    >
      <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = list[virtualRow.index];
          if (!item) return null;
          return (
            <div
              key={getItemKey?.(item, virtualRow.index) ?? virtualRow.key}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: rowGap
              }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
