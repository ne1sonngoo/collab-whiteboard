/**
 * useDrawing.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages all drawing tool state and pointer event logic.
 *
 * Responsibilities:
 *   • Tool, color, and size state
 *   • Freehand pen and eraser (continuous line segments on pointer move)
 *   • Shape tools (rect, circle, line) — preview on overlay, commit on pointer up
 *   • Text tool — delegates input UI to useTextInput; commits text to canvas here
 *   • Fill tool — flood-fill at click coordinates
 *   • Remote replay — apply any draw event received from another client
 *   • Undo/redo — delegated to useHistory
 *
 * All pixel operations are delegated to drawingUtils.js (pure functions).
 * This hook contains only React state and event routing logic.
 *
 * Each draw event sent over the socket includes userId so the server can
 * attribute strokes to the correct user for targeted undo.
 */
import { useRef, useState } from "react";
import { SHAPE_TOOLS } from "../constants";
import {
  ctx2d,
  drawShape,
  floodFill,
  commitTextToCanvas,
  applyDrawEvent,
} from "../utils/drawingUtils";
import useHistory from "./useHistory";

export default function useDrawing(
  canvasRef,
  overlayRef,
  { userId, onUndo, onRedo } = {},
) {
  // The last pointer position during a freehand stroke.
  // Null between strokes; set to {x,y} once the first point is recorded.
  const prevPoint = useRef(null);

  // The canvas-space origin of the current shape drag.
  // Null when no shape is being drawn.
  const shapeStart = useRef(null);

  // ── Tool state ────────────────────────────────────────────────────────────
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(2);

  // ── History ───────────────────────────────────────────────────────────────
  // useHistory handles undo/redo snapshots; onUndo fires an undo_last to server
  const { saveSnapshot, undo, redo, canUndo, canRedo } = useHistory(canvasRef, {
    onUndo,
    onRedo,
  });

  // ── Internal helpers ──────────────────────────────────────────────────────

  /** Clear the transparent overlay canvas (used to erase shape previews). */
  const clearOverlay = () => {
    const c = overlayRef?.current;
    if (c) c.getContext("2d").clearRect(0, 0, c.width, c.height);
  };

  /**
   * Convert a pointer event's screen coordinates to canvas pixel coordinates.
   * The canvas is CSS-scaled to fill its container, so we need to multiply
   * by the ratio of internal canvas size to displayed size.
   */
  const getCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  /**
   * Send a draw event to the server (which relays it to all other clients).
   * userId is included so the server can remove this user's strokes on undo.
   */
  const sendDraw = (socketRef, payload) => {
    if (socketRef?.current?.readyState === WebSocket.OPEN)
      socketRef.current.send(
        JSON.stringify({ type: "draw", userId, ...payload }),
      );
  };

  // ── Freehand / eraser ─────────────────────────────────────────────────────

  /**
   * handleMouseMove — called on every pointer move event while drawing.
   *
   * For pen/eraser: draws a line segment from the previous point to the current
   * point, creating a smooth continuous stroke.
   *
   * For shape tools: draws a live preview on the transparent overlay canvas
   * (not the main canvas) so the final shape hasn't been committed yet.
   */
  const handleMouseMove = (e, socketRef) => {
    const canvas = canvasRef.current;
    // Only draw when the primary button is held (buttons === 1)
    if (!canvas || e.buttons !== 1) {
      prevPoint.current = null; // reset so the next stroke starts fresh
      return;
    }

    if (SHAPE_TOOLS.has(tool)) {
      // Shape preview: clear overlay and redraw from origin to current cursor
      if (!shapeStart.current || !overlayRef?.current) return;
      const { x, y } = getCoords(e);
      const oc = overlayRef.current;
      const oc2 = oc.getContext("2d");
      oc2.clearRect(0, 0, oc.width, oc.height);
      drawShape(
        oc2,
        tool,
        shapeStart.current.x,
        shapeStart.current.y,
        x,
        y,
        color,
        size,
      );
      return;
    }

    const { x, y } = getCoords(e);

    // Skip drawing on the very first move event — we need two points for a segment
    if (!prevPoint.current) {
      prevPoint.current = { x, y };
      return;
    }

    // Draw the line segment on the main canvas
    const c = ctx2d(canvas);
    c.save(); // save context state so we can restore after setting composite op
    if (tool === "eraser") {
      // destination-out removes pixels rather than painting over them,
      // giving a true transparent erase on a canvas with no background
      c.globalCompositeOperation = "destination-out";
      c.lineWidth = size * 3; // eraser is 3× larger than pen at same size setting
    } else {
      c.globalCompositeOperation = "source-over";
      c.strokeStyle = color;
      c.lineWidth = size;
    }
    c.lineCap = "round"; // round caps make freehand strokes look smooth
    c.beginPath();
    c.moveTo(prevPoint.current.x, prevPoint.current.y);
    c.lineTo(x, y);
    c.stroke();
    c.restore(); // restore composite op so other draw calls aren't affected

    // Broadcast this segment so other clients draw it too
    sendDraw(socketRef, {
      x0: prevPoint.current.x,
      y0: prevPoint.current.y,
      x1: x,
      y1: y,
      color,
      size,
      tool,
    });

    prevPoint.current = { x, y }; // update for next segment
  };

  // ── Shape tools ───────────────────────────────────────────────────────────

  /**
   * handleShapeStart — record the drag origin on pointer down.
   * The shape is previewed live on the overlay; committed on pointer up.
   */
  const handleShapeStart = (e) => {
    if (SHAPE_TOOLS.has(tool)) shapeStart.current = getCoords(e);
  };

  /**
   * handleShapeEnd — commit the final shape to the main canvas on pointer up.
   * Clears the preview from the overlay, draws the real shape, and broadcasts.
   */
  const handleShapeEnd = (e, socketRef) => {
    if (!SHAPE_TOOLS.has(tool) || !shapeStart.current || !canvasRef.current)
      return;
    const { x, y } = getCoords(e);
    clearOverlay(); // remove the preview
    drawShape(
      ctx2d(canvasRef.current),
      tool,
      shapeStart.current.x,
      shapeStart.current.y,
      x,
      y,
      color,
      size,
    );
    sendDraw(socketRef, {
      tool,
      x0: shapeStart.current.x,
      y0: shapeStart.current.y,
      x1: x,
      y1: y,
      color,
      size,
    });
    shapeStart.current = null; // reset for next shape
  };

  // ── Text tool ─────────────────────────────────────────────────────────────

  /**
   * commitText — render confirmed text onto the main canvas and broadcast.
   * Called by Canvas after the useTextInput hook fires its onCommit callback.
   */
  const commitText = (cx, cy, text, socketRef) => {
    commitTextToCanvas(canvasRef.current, cx, cy, text, color, size);
    sendDraw(socketRef, { tool: "text", x: cx, y: cy, text, color, size });
  };

  // ── Fill tool ─────────────────────────────────────────────────────────────

  /**
   * handleFill — flood-fill from (cx, cy) with the current color and broadcast.
   * The server stores the fill as a draw event so late joiners replay it.
   */
  const handleFill = (cx, cy, socketRef) => {
    floodFill(canvasRef.current, cx, cy, color);
    sendDraw(socketRef, { tool: "fill", x: cx, y: cy, color });
  };

  // ── Remote replay ─────────────────────────────────────────────────────────

  /**
   * drawRemote — apply a draw event from another client onto the canvas.
   * applyDrawEvent in drawingUtils handles all tool types (pen, shape, text, fill, erase).
   */
  const drawRemote = (canvasRef, data) =>
    applyDrawEvent(canvasRef.current, data);

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    // Pointer handlers (called from Canvas event listeners)
    handleMouseMove,
    handleShapeStart,
    handleShapeEnd,
    // Tool-specific actions
    commitText,
    handleFill,
    // Remote sync
    drawRemote,
    // History
    saveSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    // Tool state (read by Canvas and Toolbar)
    color,
    setColor,
    size,
    setSize,
    tool,
    setTool,
    // Convenience booleans used to branch pointer logic in Canvas
    isShapeTool: SHAPE_TOOLS.has(tool),
    isTextTool: tool === "text",
    isFillTool: tool === "fill",
  };
}
