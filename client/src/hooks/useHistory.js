/**
 * useHistory.js
 * Undo/redo via ImageData snapshots.
 * Completely decoupled from tool logic — give it a canvasRef, get back
 * saveSnapshot / undo / redo and UI-ready canUndo / canRedo booleans.
 */
import { useRef, useState } from "react";
import { ctx2d } from "../utils/drawingUtils";
import { MAX_HISTORY } from "../constants";

export default function useHistory(canvasRef) {
  const historyRef = useRef([]);
  const historyIdxRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const sync = () => {
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  };

  const saveSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const snapshot = ctx2d(canvas).getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const history = historyRef.current.slice(0, historyIdxRef.current + 1);
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.shift();
    historyRef.current = history;
    historyIdxRef.current = history.length - 1;
    sync();
  };

  const undo = () => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current -= 1;
    const canvas = canvasRef.current;
    if (canvas)
      ctx2d(canvas).putImageData(
        historyRef.current[historyIdxRef.current],
        0,
        0,
      );
    sync();
  };

  const redo = () => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current += 1;
    const canvas = canvasRef.current;
    if (canvas)
      ctx2d(canvas).putImageData(
        historyRef.current[historyIdxRef.current],
        0,
        0,
      );
    sync();
  };

  return { saveSnapshot, undo, redo, canUndo, canRedo };
}
