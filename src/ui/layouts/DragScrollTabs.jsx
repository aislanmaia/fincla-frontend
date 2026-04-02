import React, { useEffect, useRef } from "react";

/* Horizontally scrollable tab strip: touch/mouse drag, bidirectional fades. */
/* Scrollbar styling: class `.dstabs-scroll` in `animations.jsx` (AnimStyles). */
export function DragScrollTabs({ children, bg = "#F8F7F5" }) {
  const scrollRef = useRef(null);
  const fadeL = useRef(null);
  const fadeR = useRef(null);

  const updateFades = () => {
    const el = scrollRef.current;
    if (!el) return;
    const canScroll = el.scrollWidth > el.clientWidth + 4;
    if (fadeL.current) fadeL.current.style.opacity = el.scrollLeft > 8 ? "1" : "0";
    if (fadeR.current) fadeR.current.style.opacity = (canScroll && el.scrollLeft + el.clientWidth < el.scrollWidth - 8) ? "1" : "0";
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(updateFades));
    return () => cancelAnimationFrame(id);
  });

  const handleMouseDown = (e) => {
    const el = scrollRef.current;
    if (!el) return;
    const startX = e.clientX;
    const startL = el.scrollLeft;
    el.style.cursor = "grabbing";
    const onMove = (mv) => { el.scrollLeft = startL - (mv.clientX - startX); };
    const onUp = () => {
      el.style.cursor = "grab";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div style={{ position: "relative", maxWidth: "100%" }}>
      <div ref={fadeL} style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 28, zIndex: 2,
        background: `linear-gradient(to right, ${bg}, transparent)`,
        pointerEvents: "none", opacity: 0, transition: "opacity 0.18s ease",
      }}/>
      <div ref={fadeR} style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: 36, zIndex: 2,
        background: `linear-gradient(to left, ${bg}, transparent)`,
        pointerEvents: "none", opacity: 0, transition: "opacity 0.18s ease",
      }}/>
      <div
        ref={scrollRef}
        className="dstabs-scroll"
        onScroll={updateFades}
        onMouseDown={handleMouseDown}
        style={{
          display: "flex", gap: 6,
          overflowX: "auto",
          paddingBottom: 4, paddingTop: 2,
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-x",
          cursor: "grab", userSelect: "none",
        }}
      >
        {children}
        <div style={{ flexShrink: 0, minWidth: 32 }}/>
      </div>
    </div>
  );
}
