import { useRef, useEffect } from "react";

export default function useSocket(boardId, onMessage) {
  const socketRef = useRef(null);
  // Always hold the latest onMessage without recreating the socket
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001");
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", room: boardId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessageRef.current(data); // always calls the latest handler
      } catch (e) {
        console.error("WS parse error", e);
      }
    };

    return () => {
      ws.close();
    };
  }, [boardId]);

  return socketRef;
}
