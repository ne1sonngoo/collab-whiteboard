/**
 * useZoomPan.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages zoom and pan state for the board viewport.
 *
 * Zoom: scroll wheel zooms toward the cursor position, keeping the point
 *       under the cursor fixed in screen space.
 * Pan:  middle-mouse-button drag OR space+left-drag moves the viewport.
 *
 * The zoom/pan is applied as a CSS transform on a wrapper div in Canvas.jsx,
 * so everything inside — canvases, notes, cursors, text input — moves together
 * without any coordinate math needed in individual components.
 *
 * Consumers call:
 *   startPanIfNeeded(e)    → in onPointerDown, returns true if pan activated
 *   continuePanIfActive(e) → in onPointerMove, returns true if currently panning
 *   endPan()               → in onPointerUp
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from "../constants";

export default function useZoomPan(containerRef) {
  // zoom.scale — CSS scale factor (1 = 100%, 2 = 200%, etc.)
  // zoom.panX/panY — CSS translate offset in screen pixels
  const [zoom, setZoom] = useState({ scale: 1, panX: 0, panY: 0 });

  // Ref copy of zoom for the wheel handler — the handler is registered once
  // via addEventListener and would otherwise capture a stale closure
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Ref that tracks an in-progress pan drag
  // { startX, startY, startPanX, startPanY } while dragging, null otherwise
  const panState = useRef(null);

  // Whether the space bar is currently held down (enables space+drag pan)
  const spaceDown = useRef(false);

  // ── Wheel handler ─────────────────────────────────────────────────────────
  // Zoom toward the cursor: adjust panX/panY so the canvas point under the
  // cursor stays in the same screen position after the scale changes.
  const handleWheel = useCallback(
    (e) => {
      e.preventDefault(); // stop browser from scrolling the page
      const { scale, panX, panY } = zoomRef.current;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Cursor position relative to the container's top-left corner
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Scale factor: zoom in (deltaY < 0) or out (deltaY > 0)
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, scale * factor));

      // Translate so the point under the cursor doesn't move:
      //   newPan = cursor - (cursor - oldPan) * (newScale / oldScale)
      setZoom({
        scale: newScale,
        panX: mx - (mx - panX) * (newScale / scale),
        panY: my - (my - panY) * (newScale / scale),
      });
    },
    [containerRef],
  );

  // Register wheel listener with { passive: false } so we can call preventDefault
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel, containerRef]);

  // ── Space-key tracking ────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e) => {
      // Only activate space-pan when focus is on the canvas, not in a text field
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

  // ── Pan start ─────────────────────────────────────────────────────────────
  /**
   * Call in onPointerDown. Returns true if pan mode was activated so the
   * caller can skip all drawing logic for this pointer event.
   */
  const startPanIfNeeded = (e) => {
    // Activate on middle mouse button (button === 1) or space+left-drag
    if (e.button !== 1 && !spaceDown.current) return false;
    e.preventDefault();
    panState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPanX: zoomRef.current.panX,
      startPanY: zoomRef.current.panY,
    };
    // Capture pointer so move events fire even outside the element
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    return true; // signal to caller: we're panning, skip drawing
  };

  // ── Pan continue ──────────────────────────────────────────────────────────
  /**
   * Call in onPointerMove. Returns true if panning is active so the caller
   * can skip cursor broadcast and drawing logic.
   */
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

  /** Call in onPointerUp to end a pan drag. */
  const endPan = () => {
    panState.current = null;
  };

  /** Reset zoom and pan to the default 100% / no offset. */
  const resetZoom = () => setZoom({ scale: 1, panX: 0, panY: 0 });

  /** Whether a pan is currently in progress (used for cursor style). */
  const isPanning = () => Boolean(panState.current);

  /** Whether the space bar is currently held (used for cursor style). */
  const isSpaceDown = () => spaceDown.current;

  return {
    zoom,
    resetZoom,
    isPanning,
    isSpaceDown,
    startPanIfNeeded,
    continuePanIfActive,
    endPan,
  };
}
