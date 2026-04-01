/**
 * useSocket.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages a single WebSocket connection for the lifetime of the board session.
 *
 * Key design decisions:
 *
 * 1. The socket is created once per boardId (useEffect with [boardId] dep).
 *    Changing the board ID tears down the old socket and creates a new one.
 *
 * 2. onMessage is stored in a ref (onMessageRef) and updated synchronously
 *    during every render. This means the ws.onmessage handler always calls the
 *    *latest* version of the callback without ever recreating the socket.
 *    Without this pattern, the handler would capture a stale closure from the
 *    first render and miss any state that was added later (e.g. note_delete).
 *
 * 3. The join message includes userId, username, and color so the server can
 *    immediately populate the presence list for this user.
 */
import { useRef, useEffect } from "react";

export default function useSocket(
  boardId,
  onMessage,
  { userId, username, color } = {},
) {
  // socketRef holds the live WebSocket instance.
  // Returning a ref (not the socket directly) means consumers always read
  // the current socket even after Strict Mode remounts.
  const socketRef = useRef(null);

  // Ref updated synchronously each render so ws.onmessage never goes stale.
  // This is intentionally NOT in a useEffect — we want it to update before
  // any potential message fires, not after the next paint.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // Also keep identity info in refs for the same reason
  const userIdRef = useRef(userId);
  const usernameRef = useRef(username);
  const colorRef = useRef(color);
  userIdRef.current = userId;
  usernameRef.current = username;
  colorRef.current = color;

  useEffect(() => {
    // Open a new WebSocket connection to the local server
    const ws = new WebSocket("ws://localhost:3001");
    socketRef.current = ws;

    ws.onopen = () => {
      // First message must be "join" — tells the server which room we're in
      // and who we are. Server responds with init + room_info + presence_update.
      ws.send(
        JSON.stringify({
          type: "join",
          room: boardId,
          userId: userIdRef.current,
          username: usernameRef.current,
          color: colorRef.current,
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        // Parse once here, pass the object to the handler.
        // onMessageRef.current is always the latest handleSocketMessage from Canvas.
        onMessageRef.current(JSON.parse(event.data));
      } catch (e) {
        console.error("[useSocket] Failed to parse message:", e);
      }
    };

    // Suppress the harmless error that React Strict Mode triggers by mounting
    // → unmounting → remounting, which closes the first socket before it connects.
    ws.onerror = () => {};

    // Cleanup: close the socket when the component unmounts or boardId changes
    return () => ws.close();
  }, [boardId]); // re-run only if the board changes, not on every render

  return socketRef;
}
