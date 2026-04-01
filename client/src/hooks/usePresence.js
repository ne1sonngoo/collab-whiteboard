/**
 * usePresence.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the list of users currently connected to the same board.
 *
 * The server owns presence state authoritatively — it tracks who is connected
 * and broadcasts a fresh presence_update list whenever anyone joins or leaves.
 * This hook just stores the latest list the server sends.
 *
 * Shape of each user object:
 *   { userId: string, username: string, color: string }
 */
import { useState, useCallback } from "react";

export default function usePresence() {
  // users is an array of user objects as sent by the server.
  // Starts empty; populated when the first presence_update arrives after join.
  const [users, setUsers] = useState([]);

  /**
   * applyPresenceUpdate — called by Canvas's handleSocketMessage when a
   * presence_update message arrives. Simply replaces the whole list since
   * the server sends the full current state every time.
   *
   * Wrapped in useCallback so it has a stable reference and won't cause
   * unnecessary re-renders if passed as a prop.
   */
  const applyPresenceUpdate = useCallback((data) => {
    setUsers(data.users || []);
  }, []);

  return { users, applyPresenceUpdate };
}
