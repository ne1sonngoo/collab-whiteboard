import { useRef, useEffect } from "react";

export default function useSocket(boardId, onMessage) {
  const socketRef = useRef(null);
  const onMessageRef = useRef(onMessage);

  // Sync assignment during render — no useEffect lag, no stale closure window.
  // By the time any ws.onmessage fires, this already points at the latest handler.
  onMessageRef.current = onMessage;

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001");
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", room: boardId }));
    };

    ws.onmessage = (event) => {
      try {
        onMessageRef.current(JSON.parse(event.data));
      } catch (e) {
        console.error("WS parse error", e);
      }
    };

    ws.onerror = () => {}; // Strict Mode fires a harmless error on the throwaway socket

    return () => ws.close();
  }, [boardId]);

  return socketRef;
}
