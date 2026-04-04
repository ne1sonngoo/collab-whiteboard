/**
 * useHistory.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Undo/redo for the drawing canvas using ImageData snapshots.
 *
 * How it works:
 *   • Before each stroke starts, saveSnapshot() captures the full canvas pixel
 *     data as an ImageData object and pushes it onto a capped stack.
 *   • undo() steps the index back one and restores that snapshot.
 *   • redo() steps the index forward one and restores that snapshot.
 *   • Starting a new stroke after an undo truncates the forward (redo) history,
 *     just like every text editor you've ever used.
 *
 * Collaborative sync:
 *   The optional onUndo / onRedo callbacks let Canvas send undo_last /
 *   redo_last messages to the server after each local operation. The server
 *   then rebroadcasts a full init to all clients so every canvas stays in sync.
 *
 * Memory note:
 *   Each 1400×800 snapshot is ~4.5 MB (4 bytes × 1400 × 800).
 *   MAX_HISTORY = 30 caps usage at ~135 MB — acceptable for a browser tab.
 */
import { useRef, useState } from "react";
import { ctx2d } from "../utils/drawingUtils";
import { MAX_HISTORY } from "../constants";

export default function useHistory(canvasRef, { onUndo, onRedo } = {}) {
  // The snapshot stack — array of ImageData objects
  const historyRef = useRef([]);
  // Current position in the stack. -1 = empty, 0 = first snapshot, etc.
  const historyIdxRef = useRef(-1);

  // Boolean states exposed to the UI so undo/redo buttons can be greyed out
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  /** Update the canUndo/canRedo booleans to reflect the current stack position. */
  const sync = () => {
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  };

  /**
   * saveSnapshot — capture the canvas state before a stroke begins.
   * Must be called in onPointerDown, not during drawing, so each complete
   * stroke is one undo step rather than one undo step per pixel.
   */
  const saveSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Capture full canvas pixel data
    const snapshot = ctx2d(canvas).getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );

    // Truncate any forward history (redo stack) — new action invalidates it
    const history = historyRef.current.slice(0, historyIdxRef.current + 1);
    history.push(snapshot);

    // Cap memory usage — drop the oldest entry when over the limit
    if (history.length > MAX_HISTORY) history.shift();

    historyRef.current = history;
    historyIdxRef.current = history.length - 1;
    sync();
  };

  /**
   * undo — restore the previous snapshot and notify the server.
   * onUndo() triggers an undo_last message so the server pops this user's
   * last stroke and rebroadcasts init to resync all other clients.
   */
  const undo = () => {
    if (historyIdxRef.current <= 0) return; // nothing to undo
    historyIdxRef.current -= 1;
    const canvas = canvasRef.current;
    if (canvas)
      ctx2d(canvas).putImageData(
        historyRef.current[historyIdxRef.current],
        0,
        0,
      );
    sync();
    onUndo?.(); // notify Canvas to send undo_last to server
  };

  /**
   * redo — restore the next snapshot and notify the server.
   * onRedo() triggers a redo_last message so the server re-adds the previously
   * undone stroke and rebroadcasts init to resync all other clients.
   */
  const redo = () => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return; // nothing to redo
    historyIdxRef.current += 1;
    const canvas = canvasRef.current;
    if (canvas)
      ctx2d(canvas).putImageData(
        historyRef.current[historyIdxRef.current],
        0,
        0,
      );
    sync();
    onRedo?.(); // notify Canvas to send redo_last to server
  };

  return { saveSnapshot, undo, redo, canUndo, canRedo };
}
