import { useRef } from "react";

export default function useDrawing(canvasRef, socketRef) {
  const prevPoint = useRef(null);

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (e.buttons !== 1) {
      prevPoint.current = null;
      return;
    }

    if (!prevPoint.current) {
      prevPoint.current = { x, y };
      return;
    }

    const { x: x1, y: y1 } = prevPoint.current;
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x, y);
    ctx.stroke();

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({ type: "draw", x1, y1, x2: x, y2: y }),
      );
    }

    prevPoint.current = { x, y };
  };

  const drawRemote = (canvasRef, data) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(data.x1, data.y1);
    ctx.lineTo(data.x2, data.y2);
    ctx.stroke();
  };

  return { handleMouseMove, drawRemote };
}
