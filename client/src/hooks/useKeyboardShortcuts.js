/**
 * useKeyboardShortcuts.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Registers global keyboard shortcuts for undo and redo.
 *
 * Supported shortcuts:
 *   Ctrl+Z (Win/Linux) / Cmd+Z (Mac) → undo
 *   Ctrl+Y (Win/Linux) / Cmd+Y (Mac) → redo
 *   Ctrl+Shift+Z / Cmd+Shift+Z       → redo (alternative)
 *
 * Note: useTextInput.js calls e.stopPropagation() on keydown events inside
 * its textarea, so these shortcuts won't fire while the user is typing text
 * onto the canvas.
 */
import { useEffect } from "react";

/** Detect macOS so we use metaKey (Cmd) instead of ctrlKey */
const isMac = () => navigator.platform.toUpperCase().includes("MAC");

export default function useKeyboardShortcuts({ undo, redo }) {
  useEffect(() => {
    const handle = (e) => {
      // Use Cmd on Mac, Ctrl everywhere else
      const mod = isMac() ? e.metaKey : e.ctrlKey;
      if (!mod) return; // ignore keypresses without the modifier

      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (e.key === "y") {
        e.preventDefault();
        redo();
      }
      if (e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handle);
    // Clean up when the component unmounts to prevent duplicate listeners
    return () => window.removeEventListener("keydown", handle);
  }, [undo, redo]); // re-register if undo/redo functions change identity
}
