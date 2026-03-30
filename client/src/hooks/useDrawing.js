/**
 * useDrawing.js
 * Tool state + pointer logic. Delegates pixel ops to drawingUtils.
 * Delegates undo/redo to useHistory.
 * Each draw event includes userId so the server can target undo correctly.
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
  const prevPoint = useRef(null);
  const shapeStart = useRef(null);

  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(2);

  const { saveSnapshot, undo, redo, canUndo, canRedo } = useHistory(canvasRef, {
    onUndo,
    onRedo,
  });

  const clearOverlay = () => {
    const c = overlayRef?.current;
    if (c) c.getContext("2d").clearRect(0, 0, c.width, c.height);
  };

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const sendDraw = (socketRef, payload) => {
    if (socketRef?.current?.readyState === WebSocket.OPEN)
      socketRef.current.send(
        JSON.stringify({ type: "draw", userId, ...payload }),
      );
  };

  // ── Freehand / eraser ─────────────────────────────────────────────────────
  const handleMouseMove = (e, socketRef) => {
    const canvas = canvasRef.current;
    if (!canvas || e.buttons !== 1) {
      prevPoint.current = null;
      return;
    }

    if (SHAPE_TOOLS.has(tool)) {
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
    if (!prevPoint.current) {
      prevPoint.current = { x, y };
      return;
    }

    const c = ctx2d(canvas);
    c.save();
    if (tool === "eraser") {
      c.globalCompositeOperation = "destination-out";
      c.lineWidth = size * 3;
    } else {
      c.globalCompositeOperation = "source-over";
      c.strokeStyle = color;
      c.lineWidth = size;
    }
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(prevPoint.current.x, prevPoint.current.y);
    c.lineTo(x, y);
    c.stroke();
    c.restore();

    sendDraw(socketRef, {
      x0: prevPoint.current.x,
      y0: prevPoint.current.y,
      x1: x,
      y1: y,
      color,
      size,
      tool,
    });
    prevPoint.current = { x, y };
  };

  // ── Shapes ────────────────────────────────────────────────────────────────
  const handleShapeStart = (e) => {
    if (SHAPE_TOOLS.has(tool)) shapeStart.current = getCoords(e);
  };

  const handleShapeEnd = (e, socketRef) => {
    if (!SHAPE_TOOLS.has(tool) || !shapeStart.current || !canvasRef.current)
      return;
    const { x, y } = getCoords(e);
    clearOverlay();
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
    shapeStart.current = null;
  };

  // ── Text ──────────────────────────────────────────────────────────────────
  const commitText = (cx, cy, text, socketRef) => {
    commitTextToCanvas(canvasRef.current, cx, cy, text, color, size);
    sendDraw(socketRef, { tool: "text", x: cx, y: cy, text, color, size });
  };

  // ── Fill ──────────────────────────────────────────────────────────────────
  const handleFill = (cx, cy, socketRef) => {
    floodFill(canvasRef.current, cx, cy, color);
    sendDraw(socketRef, { tool: "fill", x: cx, y: cy, color });
  };

  // ── Remote replay ─────────────────────────────────────────────────────────
  const drawRemote = (canvasRef, data) =>
    applyDrawEvent(canvasRef.current, data);

  return {
    handleMouseMove,
    handleShapeStart,
    handleShapeEnd,
    commitText,
    handleFill,
    drawRemote,
    saveSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    color,
    setColor,
    size,
    setSize,
    tool,
    setTool,
    isShapeTool: SHAPE_TOOLS.has(tool),
    isTextTool: tool === "text",
    isFillTool: tool === "fill",
  };
}
