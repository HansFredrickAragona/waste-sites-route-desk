import { useLayoutEffect, useRef } from "react";

export default function AnimatedSize({ children, className = "", collapsed = false }) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const previousHeightRef = useRef(null);
  const animationFrameRef = useRef(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return undefined;

    const nextHeight = collapsed ? 0 : content.getBoundingClientRect().height;
    const previousHeight = previousHeightRef.current;
    previousHeightRef.current = nextHeight;

    if (previousHeight === null) {
      if (collapsed) container.style.height = "0px";
      return undefined;
    }

    const currentHeight = container.style.height && container.style.height !== "auto"
      ? container.getBoundingClientRect().height
      : previousHeight;
    if (Math.abs(nextHeight - currentHeight) < 1) {
      container.style.height = collapsed ? "0px" : "auto";
      return undefined;
    }

    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    container.style.height = `${currentHeight}px`;
    container.getBoundingClientRect();
    animationFrameRef.current = requestAnimationFrame(() => {
      if (container.isConnected) container.style.height = `${nextHeight}px`;
      animationFrameRef.current = null;
    });

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [children, collapsed]);

  function finishSizeTransition(event) {
    if (event.target !== event.currentTarget || event.propertyName !== "height") return;
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    container.style.height = collapsed ? "0px" : "auto";
    previousHeightRef.current = collapsed ? 0 : content.getBoundingClientRect().height;
  }

  return (
    <div
      ref={containerRef}
      className={`card-size-transition${collapsed ? " card-size-transition--collapsed" : ""}${className ? ` ${className}` : ""}`}
      aria-hidden={collapsed || undefined}
      inert={collapsed}
      onTransitionEnd={finishSizeTransition}
    >
      <div ref={contentRef} className="card-size-transition__content">{children}</div>
    </div>
  );
}
