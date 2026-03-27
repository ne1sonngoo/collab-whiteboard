import { useRef, useState } from "react";

const MAX_HISTORY = 30;
const SHAPE_TOOLS = new Set(["rect", "circle", "line"]);

const ctx2d = (canvas) => canvas.getContext("2d", { willReadFrequently: true });

function drawShape(ctx, tool, x0, y0, x1, y1, color, size) {
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (tool === "rect") {
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  } else if (tool === "circle") {
    const rx = (x1 - x0) / 2;
    const ry = (y1 - y0) / 2;
    ctx.ellipse(
      x0 + rx,
      y0 + ry,
      Math.abs(rx),
      Math.abs(ry),
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  } else if (tool === "line") {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}

export default function useDrawing(canvasRef, overlayRef) {
  const prevPoint = useRef(null);
  const shapeStart = useRef(null);
  const historyRef = useRef([]);
  const historyIdxRef = useRef(-1);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(2);

  const syncUndoState = () => {
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  };

  const saveSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const snapshot = ctx2d(canvas).getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const history = historyRef.current.slice(0, historyIdxRef.current + 1);
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.shift();
    historyRef.current = history;
    historyIdxRef.current = history.length - 1;
    syncUndoState();
  };

  const undo = () => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current -= 1;
    if (canvasRef.current)
      ctx2d(canvasRef.current).putImageData(
        historyRef.current[historyIdxRef.current],
        0,
        0,
      );
    syncUndoState();
  };

  const redo = () => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current += 1;
    if (canvasRef.current)
      ctx2d(canvasRef.current).putImageData(
        historyRef.current[historyIdxRef.current],
        0,
        0,
      );
    syncUndoState();
  };

  const clearOverlay = () => {
    if (!overlayRef?.current) return;
    const c = overlayRef.current;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
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

  // ── Freehand / eraser ────────────────────────────────────────────────────
  const handleMouseMove = (e, socketRef) => {
    if (!canvasRef.current || e.buttons !== 1) {
      if (e.buttons !== 1) prevPoint.current = null;
      return;
    }

    if (SHAPE_TOOLS.has(tool)) {
      // Shape preview on overlay
      if (!shapeStart.current) return;
      const { x, y } = getCoords(e);
      if (overlayRef?.current) {
        const oc = overlayRef.current;
        const octx = oc.getContext("2d");
        octx.clearRect(0, 0, oc.width, oc.height);
        drawShape(
          octx,
          tool,
          shapeStart.current.x,
          shapeStart.current.y,
          x,
          y,
          color,
          size,
        );
      }
      return;
    }

    const { x, y } = getCoords(e);
    if (prevPoint.current) {
      const ctx = ctx2d(canvasRef.current);
      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = size * 3;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
      }
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(prevPoint.current.x, prevPoint.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";

      if (socketRef?.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: "draw",
            x0: prevPoint.current.x,
            y0: prevPoint.current.y,
            x1: x,
            y1: y,
            color,
            size,
            tool,
          }),
        );
      }
    }
    prevPoint.current = { x, y };
  };

  // ── Shape start ──────────────────────────────────────────────────────────
  const handleShapeStart = (e) => {
    if (!SHAPE_TOOLS.has(tool)) return;
    shapeStart.current = getCoords(e);
  };

  // ── Shape commit ─────────────────────────────────────────────────────────
  const handleShapeEnd = (e, socketRef) => {
    if (!SHAPE_TOOLS.has(tool) || !shapeStart.current || !canvasRef.current)
      return;
    const { x, y } = getCoords(e);
    clearOverlay();

    const ctx = ctx2d(canvasRef.current);
    drawShape(
      ctx,
      tool,
      shapeStart.current.x,
      shapeStart.current.y,
      x,
      y,
      color,
      size,
    );

    if (socketRef?.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "draw",
          tool,
          x0: shapeStart.current.x,
          y0: shapeStart.current.y,
          x1: x,
          y1: y,
          color,
          size,
        }),
      );
    }
    shapeStart.current = null;
  };

  // ── Remote draw (freehand + shapes use same event) ───────────────────────
  const drawRemote = (canvasRef, data) => {
    if (!canvasRef.current) return;
    const ctx = ctx2d(canvasRef.current);
    if (SHAPE_TOOLS.has(data.tool)) {
      drawShape(
        ctx,
        data.tool,
        data.x0,
        data.y0,
        data.x1,
        data.y1,
        data.color || "#000",
        data.size || 2,
      );
      return;
    }
    if (data.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = (data.size || 2) * 3;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = data.color || "#000";
      ctx.lineWidth = data.size || 2;
    }
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(data.x0, data.y0);
    ctx.lineTo(data.x1, data.y1);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  };

  return {
    handleMouseMove,
    handleShapeStart,
    handleShapeEnd,
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
  };
}
