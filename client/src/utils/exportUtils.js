/**
 * exportUtils.js
 * Board export to PNG — composites drawing canvas + sticky notes.
 */
import { ctx2d } from "./drawingUtils";
import { CANVAS_W, CANVAS_H } from "../constants";

/**
 * @param {HTMLCanvasElement} canvas  The main drawing canvas
 * @param {Array}             notes   Note objects from useNotes
 * @param {string}            boardId Used in filename
 */
export function exportBoardAsPng(canvas, notes, boardId) {
  if (!canvas) {
    console.error("exportBoardAsPng: canvas is null");
    return;
  }

  try {
    const off = document.createElement("canvas");
    off.width = CANVAS_W;
    off.height = CANVAS_H;
    const octx = off.getContext("2d");

    // White background
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Drawing layer
    octx.drawImage(canvas, 0, 0);

    // Notes layer
    const noteW = Math.round(CANVAS_W * 0.12);
    const noteH = Math.round(CANVAS_H * 0.18);
    const fontSize = Math.round(noteW * 0.08);

    notes.forEach((note) => {
      octx.fillStyle = note.color;
      octx.fillRect(note.x, note.y, noteW, noteH);
      octx.strokeStyle = "rgba(0,0,0,0.15)";
      octx.lineWidth = 1;
      octx.strokeRect(note.x, note.y, noteW, noteH);
      octx.fillStyle = "#333";
      octx.font = `${fontSize}px sans-serif`;
      (note.text || "").split("\n").forEach((line, i) => {
        octx.fillText(
          line,
          note.x + 8,
          note.y + fontSize + 8 + i * fontSize * 1.4,
          noteW - 16,
        );
      });
    });

    const a = document.createElement("a");
    a.download = `board-${boardId}.png`;
    a.href = off.toDataURL();
    a.click();
  } catch (err) {
    console.error("exportBoardAsPng failed:", err);
  }
}
