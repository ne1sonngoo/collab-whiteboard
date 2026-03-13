import { useEffect, useRef } from "react";

export default function Canvas() {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = new WebSocket("ws://localhost:3001");

    socketRef.current.onmessage = (event) => {
      const ctx = canvasRef.current.getContext("2d");
      const { x, y } = JSON.parse(event.data);

      ctx.fillRect(x, y, 5, 5);
    };
  }, []);

  const handleMouseMove = (e) => {
    if (e.buttons !== 1) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvasRef.current.getContext("2d");
    ctx.fillRect(x, y, 5, 5);

    socketRef.current.send(JSON.stringify({ x, y }));
  };

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={500}
      onMouseMove={handleMouseMove}
      style={{ border: "1px solid black" }}
    />
  );
}