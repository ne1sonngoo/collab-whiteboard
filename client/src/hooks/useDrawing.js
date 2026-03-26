import { useRef, useState } from "react";

const MAX_HISTORY = 30;

export default function useDrawing(canvasRef, socketRef) {
  const prevPoint = useRef(null);

  // Undo/redo history stored as ImageData snapshots
  const historyRef = useRef([]);
  const historyIdxRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(2);

  // Keep canUndo/canRedo state in sync with the refs
  const syncUndoState = () => {
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  };

  /**
   * Capture the current canvas pixels as a snapshot.
   * Call this on pointerDown (before each stroke) so every stroke
   * is one discrete undo step.
   */
  const saveSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Discard any forward history (redo stack) and append
    const truncated = historyRef.current.slice(0, historyIdxRef.current + 1);
    truncated.push(snapshot);

    // Cap history size to avoid memory bloat (1400×800 ≈ 4.5 MB each)
    if (truncated.length > MAX_HISTORY) {
      truncated.shift();
    }

    historyRef.current = truncated;
    historyIdxRef.current = truncated.length - 1;
    syncUndoState();
  };

  const undo = () => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current -= 1;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas
      .getContext("2d")
      .putImageData(historyRef.current[historyIdxRef.current], 0, 0);
    syncUndoState();
  };

  const redo = () => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current += 1;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas
      .getContext("2d")
      .putImageData(historyRef.current[historyIdxRef.current], 0, 0);
    syncUndoState();
  };

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;

    if (e.buttons !== 1) {
      prevPoint.current = null;
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (prevPoint.current) {
      const ctx = canvasRef.current.getContext("2d");

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

      if (socketRef.current?.readyState === WebSocket.OPEN) {
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

  const drawRemote = (canvasRef, data) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");

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
  };
}
