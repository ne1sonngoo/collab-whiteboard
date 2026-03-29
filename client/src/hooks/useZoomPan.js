/**
 * useZoomPan.js
 * Wheel-to-zoom + space/middle-click-to-pan.
 * Returns zoom state, event handlers, and a reset function.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from "../constants";

export default function useZoomPan(containerRef) {
  const [zoom, setZoom] = useState({ scale: 1, panX: 0, panY: 0 });
  const zoomRef = useRef(zoom);
  const panState = useRef(null);
  const spaceDown = useRef(false);

  // Keep zoomRef in sync so the wheel handler (registered once) sees latest values
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Wheel → zoom toward cursor
  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      const { scale, panX, panY } = zoomRef.current;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, scale * factor));
      setZoom({
        scale: next,
        panX: mx - (mx - panX) * (next / scale),
        panY: my - (my - panY) * (next / scale),
      });
    },
    [containerRef],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel, containerRef]);

  // Space key tracking
  useEffect(() => {
    const down = (e) => {
      if (
        e.code === "Space" &&
        e.target.tagName !== "TEXTAREA" &&
        e.target.tagName !== "INPUT"
      ) {
        e.preventDefault();
        spaceDown.current = true;
      }
    };
    const up = (e) => {
      if (e.code === "Space") spaceDown.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Call on pointerDown — returns true if pan mode was activated
  const startPanIfNeeded = (e) => {
    if (e.button !== 1 && !spaceDown.current) return false;
    e.preventDefault();
    panState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPanX: zoomRef.current.panX,
      startPanY: zoomRef.current.panY,
    };
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    return true;
  };

  // Call on pointerMove — returns true if currently panning
  const continuePanIfActive = (e) => {
    if (!panState.current) return false;
    const dx = e.clientX - panState.current.startX;
    const dy = e.clientY - panState.current.startY;
    setZoom((prev) => ({
      ...prev,
      panX: panState.current.startPanX + dx,
      panY: panState.current.startPanY + dy,
    }));
    return true;
  };

  // Call on pointerUp
  const endPan = () => {
    panState.current = null;
  };

  const resetZoom = () => setZoom({ scale: 1, panX: 0, panY: 0 });

  const isPanning = () => Boolean(panState.current);

  return {
    zoom,
    resetZoom,
    isPanning,
    startPanIfNeeded,
    continuePanIfActive,
    endPan,
    isSpaceDown: () => spaceDown.current,
  };
}
