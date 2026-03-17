import { useRef, useState } from "react";

export default function useDrawing(canvasRef, socketRef) {
  const prevPoint = useRef(null);

  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(2);

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

    const ctx = canvasRef.current.getContext("2d");

    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";

    if (prevPoint.current) {
      ctx.beginPath();
      ctx.moveTo(prevPoint.current.x, prevPoint.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();

      if (
        socketRef.current &&
        socketRef.current.readyState === WebSocket.OPEN
      ) {
        socketRef.current.send(
          JSON.stringify({
            type: "draw",
            x0: prevPoint.current.x,
            y0: prevPoint.current.y,
            x1: x,
            y1: y,
            color,
            size,
          }),
        );
      }
    }

    prevPoint.current = { x, y };
  };

  const drawRemote = (canvasRef, data) => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");

    ctx.strokeStyle = data.color || "#000";
    ctx.lineWidth = data.size || 2;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(data.x0, data.y0);
    ctx.lineTo(data.x1, data.y1);
    ctx.stroke();
  };

  return {
    handleMouseMove,
    drawRemote,
    color,
    setColor,
    size,
    setSize,
  };
}
