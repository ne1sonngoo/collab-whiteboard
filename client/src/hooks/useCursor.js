import { useState } from "react";

export default function useCursor() {
  const [cursors, setCursors] = useState({});

  const updateCursor = (userId, x, y) => {
    setCursors((prev) => ({
      ...prev,
      [userId]: { x, y, color: prev[userId]?.color || "#3b82f6" },
    }));
  };

  return { cursors, updateCursor };
}
