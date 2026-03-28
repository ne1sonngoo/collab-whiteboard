import { useRef, useState } from "react";

const MAX_HISTORY = 30;
const SHAPE_TOOLS = new Set(["rect", "circle", "line"]);

export const ctx2d = (canvas) =>
  canvas.getContext("2d", { willReadFrequently: true });

// ── Shape renderer (used for local draw + remote replay) ─────────────────────
export function drawShape(ctx, tool, x0, y0, x1, y1, color, size) {
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

// ── Flood fill ───────────────────────────────────────────────────────────────
export function floodFill(canvas, startX, startY, fillHex) {
  const ctx = ctx2d(canvas);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;
  const sx = Math.max(0, Math.min(w - 1, Math.floor(startX)));
  const sy = Math.max(0, Math.min(h - 1, Math.floor(startY)));

  const fr = parseInt(fillHex.slice(1, 3), 16);
  const fg = parseInt(fillHex.slice(3, 5), 16);
  const fb = parseInt(fillHex.slice(5, 7), 16);

  const si = (sy * w + sx) * 4;
  const tr = data[si],
    tg = data[si + 1],
    tb = data[si + 2],
    ta = data[si + 3];

  // Already the fill color
  if (tr === fr && tg === fg && tb === fb && ta === 255) return;

  const TOL = 30;
  const matches = (i) =>
    Math.abs(data[i] - tr) <= TOL &&
    Math.abs(data[i + 1] - tg) <= TOL &&
    Math.abs(data[i + 2] - tb) <= TOL &&
    Math.abs(data[i + 3] - ta) <= TOL;

  const visited = new Uint8Array(w * h);
  const stack = [sy * w + sx];

  while (stack.length) {
    const pos = stack.pop();
    if (visited[pos]) continue;
    visited[pos] = 1;
    const x = pos % w;
    const y = (pos / w) | 0;
    const i = pos * 4;
    if (!matches(i)) continue;
    data[i] = fr;
    data[i + 1] = fg;
    data[i + 2] = fb;
    data[i + 3] = 255;
    if (x > 0) stack.push(pos - 1);
    if (x < w - 1) stack.push(pos + 1);
    if (y > 0) stack.push(pos - w);
    if (y < h - 1) stack.push(pos + w);
  }
  ctx.putImageData(imageData, 0, 0);
}

// ── Hook ─────────────────────────────────────────────────────────────────────
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

  // ── Freehand / eraser ─────────────────────────────────────────────────────
  const handleMouseMove = (e, socketRef) => {
    if (!canvasRef.current || e.buttons !== 1) {
      if (e.buttons !== 1) prevPoint.current = null;
      return;
    }

    if (SHAPE_TOOLS.has(tool)) {
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

  // ── Shape start/end ───────────────────────────────────────────────────────
  const handleShapeStart = (e) => {
    if (!SHAPE_TOOLS.has(tool)) return;
    shapeStart.current = getCoords(e);
  };

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

  // ── Text commit ───────────────────────────────────────────────────────────
  const commitText = (cx, cy, text, socketRef) => {
    if (!canvasRef.current || !text.trim()) return;
    const canvas = canvasRef.current;
    const ctx = ctx2d(canvas);
    const fontSize = Math.max(12, size * 8);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px sans-serif`;
    // Support multi-line
    text.split("\n").forEach((line, i) => {
      ctx.fillText(line, cx, cy + i * fontSize * 1.2);
    });
    if (socketRef?.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "draw",
          tool: "text",
          x: cx,
          y: cy,
          text,
          color,
          size,
        }),
      );
    }
  };

  // ── Fill ──────────────────────────────────────────────────────────────────
  const handleFill = (cx, cy, socketRef) => {
    if (!canvasRef.current) return;
    floodFill(canvasRef.current, cx, cy, color);
    if (socketRef?.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "draw",
          tool: "fill",
          x: cx,
          y: cy,
          color,
        }),
      );
    }
  };

  // ── Remote draw ───────────────────────────────────────────────────────────
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
    if (data.tool === "text") {
      const fontSize = Math.max(12, (data.size || 2) * 8);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = data.color || "#000";
      ctx.font = `${fontSize}px sans-serif`;
      (data.text || "").split("\n").forEach((line, i) => {
        ctx.fillText(line, data.x, data.y + i * fontSize * 1.2);
      });
      return;
    }
    if (data.tool === "fill") {
      floodFill(canvasRef.current, data.x, data.y, data.color || "#000");
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
