import { useEffect, useRef, useState } from "react";

const HANDLE_WIDTH = 14;
const MIN_COLUMN_WIDTH = 300;

function clampPanelRatio(ratio, layoutWidth) {
  const minimum = Math.max(0.24, MIN_COLUMN_WIDTH / layoutWidth);
  const maximum = Math.min(0.78, 1 - (MIN_COLUMN_WIDTH + HANDLE_WIDTH) / layoutWidth);
  return Math.max(minimum, Math.min(maximum, ratio));
}

export default function MapColumnResizer({ onWidthChange }) {
  const handleRef = useRef(null);
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [panelPercent, setPanelPercent] = useState(33);

  useEffect(() => {
    const layout = handleRef.current?.parentElement;
    const panel = layout?.querySelector(".barangay-tools-panel");
    if (!layout || !panel) return undefined;

    const updatePercent = () => {
      const layoutWidth = layout.getBoundingClientRect().width;
      if (layoutWidth > 0) setPanelPercent(Math.round(panel.getBoundingClientRect().width / layoutWidth * 100));
    };
    const observer = new ResizeObserver(updatePercent);
    observer.observe(layout);
    observer.observe(panel);
    updatePercent();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!dragging) return undefined;
    document.documentElement.classList.add("map-columns-resizing");
    return () => document.documentElement.classList.remove("map-columns-resizing");
  }, [dragging]);

  function startDrag(event) {
    if (!event.isPrimary || event.button !== 0) return;
    const layout = event.currentTarget.parentElement;
    const panel = layout?.querySelector(".barangay-tools-panel");
    const layoutWidth = layout?.getBoundingClientRect().width;
    if (!panel || !layoutWidth) return;

    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startRatio: panel.getBoundingClientRect().width / layoutWidth,
      layoutWidth,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function moveDrag(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextRatio = drag.startRatio - (event.clientX - drag.startX) / drag.layoutWidth;
    onWidthChange(clampPanelRatio(nextRatio, drag.layoutWidth));
  }

  function stopDrag(event) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleKeyDown(event) {
    const layout = event.currentTarget.parentElement;
    const panel = layout?.querySelector(".barangay-tools-panel");
    const layoutWidth = layout?.getBoundingClientRect().width;
    if (!panel || !layoutWidth) return;
    const currentRatio = panel.getBoundingClientRect().width / layoutWidth;
    let nextRatio;
    if (event.key === "ArrowLeft") nextRatio = currentRatio + 0.04;
    else if (event.key === "ArrowRight") nextRatio = currentRatio - 0.04;
    else if (event.key === "Home") nextRatio = 0;
    else if (event.key === "End") nextRatio = 1;
    else return;
    event.preventDefault();
    onWidthChange(clampPanelRatio(nextRatio, layoutWidth));
  }

  return (
    <div
      ref={handleRef}
      className={`map-column-resizer${dragging ? " map-column-resizer--dragging" : ""}`}
      role="separator"
      tabIndex={0}
      aria-label="Resize map and Pins and Firing lines column"
      aria-orientation="vertical"
      aria-valuemin={24}
      aria-valuemax={78}
      aria-valuenow={panelPercent}
      aria-valuetext={`Pins and Firing lines column uses ${panelPercent}% of the map area`}
      title="Drag to resize the map and Pins/Firing lines column. Double-click to reset."
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onLostPointerCapture={stopDrag}
      onKeyDown={handleKeyDown}
      onDoubleClick={() => onWidthChange(null)}
    />
  );
}
