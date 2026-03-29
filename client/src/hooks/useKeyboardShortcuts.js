/**
 * useKeyboardShortcuts.js
 * Global keyboard shortcuts — Ctrl/Cmd+Z, Ctrl/Cmd+Y, Ctrl/Cmd+Shift+Z.
 */
import { useEffect } from "react";

const isMac = () => navigator.platform.toUpperCase().includes("MAC");

export default function useKeyboardShortcuts({ undo, redo }) {
  useEffect(() => {
    const handle = (e) => {
      const mod = isMac() ? e.metaKey : e.ctrlKey;
      if (!mod) return;
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
    return () => window.removeEventListener("keydown", handle);
  }, [undo, redo]);
}
