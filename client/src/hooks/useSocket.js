import { useRef, useEffect } from "react";

export default function useSocket(boardId, onMessage) {
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = new WebSocket("ws://localhost:3001");

    socketRef.current.onopen = () => {
      socketRef.current.send(JSON.stringify({ type: "join", room: boardId }));
    };

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    return () => {
      socketRef.current.close();
    };
  }, [boardId]);

  return socketRef;
}
