/**
 * useCursor.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks the live canvas-space positions of all *other* users' cursors.
 * (The local user's cursor is just the OS mouse pointer — no tracking needed.)
 *
 * Each remote cursor is stored as:
 *   { x, y, color, username }
 * where x/y are canvas pixel coordinates and color is a stable per-user color
 * assigned on first sighting (preserved across moves by checking prev state).
 *
 * The cursors object is keyed by userId so updating one user never rebuilds
 * the whole map — React only re-renders the cursor for the changed user.
 */
import { useState, useCallback } from "react";

export default function useCursor() {
  // { [userId]: { x, y, color, username } }
  const [cursors, setCursors] = useState({});

  /**
   * updateCursor — called by Canvas whenever a cursor_move message arrives.
   *
   * useCallback with [] deps gives a stable function reference so
   * handleSocketMessage in Canvas doesn't recreate on every render.
   */
  const updateCursor = useCallback((userId, x, y, username) => {
    setCursors((prev) => ({
      ...prev,
      [userId]: {
        x,
        y,
        // Preserve existing color if we've seen this user before;
        // otherwise default to blue (will be overridden by presence color if available)
        color: prev[userId]?.color || "#3b82f6",
        username: username || "User",
      },
    }));
  }, []); // stable — no external dependencies

  return { cursors, updateCursor };
}
