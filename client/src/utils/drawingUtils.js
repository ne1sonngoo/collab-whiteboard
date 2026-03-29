/**
 * drawingUtils.js
 * Pure canvas utility functions — no React, no state.
 * Import these anywhere; easy to unit-test in isolation.
 */
import { FILL_TOLERANCE, SHAPE_TOOLS } from "../constants";

// ── Context helper ───────────────────────────────────────────────────────────
/** Always request willReadFrequently so getImageData/putImageData stay fast. */
export const ctx2d = (canvas) =>
  canvas.getContext("2d", { willReadFrequently: true });

// ── Shape drawing ────────────────────────────────────────────────────────────
/**
 * Draw a shape onto an existing ctx.
 * Pure — no side effects beyond writing pixels.
 */
export function drawShape(ctx, tool, x0, y0, x1, y1, color, size) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  switch (tool) {
    case "rect":
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      break;
    case "circle": {
      const rx = (x1 - x0) / 2;
      const ry = (y1 - y0) / 2;
      ctx.ellipse(
        x0 + rx,
        y0 + ry,
        Math.abs(rx),
        Math.abs(ry),
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      break;
    }
    case "line":
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      break;
    default:
      break;
  }
  ctx.restore();
}

// ── Text rendering ───────────────────────────────────────────────────────────
/**
 * Render multi-line text onto a canvas at canvas-space coords.
 */
export function commitTextToCanvas(canvas, cx, cy, text, color, size) {
  if (!canvas || !text?.trim()) return;
  const fontSize = Math.max(12, size * 8);
  const c = ctx2d(canvas);
  c.save();
  c.globalCompositeOperation = "source-over";
  c.fillStyle = color;
  c.font = `${fontSize}px sans-serif`;
  text.split("\n").forEach((line, i) => {
    c.fillText(line, cx, cy + i * fontSize * 1.2);
  });
  c.restore();
}

// ── Flood fill ───────────────────────────────────────────────────────────────
/**
 * Stack-based flood fill. Operates directly on canvas pixel data.
 * @param {HTMLCanvasElement} canvas
 * @param {number} startX  canvas-space x
 * @param {number} startY  canvas-space y
 * @param {string} fillHex e.g. "#ff0000"
 */
export function floodFill(canvas, startX, startY, fillHex) {
  if (!canvas) return;
  const ctx = ctx2d(canvas);
  const w = canvas.width;
  const h = canvas.height;
  const sx = Math.max(0, Math.min(w - 1, Math.floor(startX)));
  const sy = Math.max(0, Math.min(h - 1, Math.floor(startY)));

  const fr = parseInt(fillHex.slice(1, 3), 16);
  const fg = parseInt(fillHex.slice(3, 5), 16);
  const fb = parseInt(fillHex.slice(5, 7), 16);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const si = (sy * w + sx) * 4;
  const [tr, tg, tb, ta] = [data[si], data[si + 1], data[si + 2], data[si + 3]];

  // Already the target color — nothing to do
  if (tr === fr && tg === fg && tb === fb && ta === 255) return;

  const matches = (i) =>
    Math.abs(data[i] - tr) <= FILL_TOLERANCE &&
    Math.abs(data[i + 1] - tg) <= FILL_TOLERANCE &&
    Math.abs(data[i + 2] - tb) <= FILL_TOLERANCE &&
    Math.abs(data[i + 3] - ta) <= FILL_TOLERANCE;

  const visited = new Uint8Array(w * h);
  const stack = [sy * w + sx];

  while (stack.length) {
    const pos = stack.pop();
    if (visited[pos]) continue;
    visited[pos] = 1;
    const i = pos * 4;
    if (!matches(i)) continue;
    data[i] = fr;
    data[i + 1] = fg;
    data[i + 2] = fb;
    data[i + 3] = 255;
    const x = pos % w;
    const y = (pos / w) | 0;
    if (x > 0) stack.push(pos - 1);
    if (x < w - 1) stack.push(pos + 1);
    if (y > 0) stack.push(pos - w);
    if (y < h - 1) stack.push(pos + w);
  }
  ctx.putImageData(imageData, 0, 0);
}

// ── Remote draw dispatcher ───────────────────────────────────────────────────
/**
 * Replay a single draw event (any tool) onto a canvas.
 * Used both for live remote strokes and for init replay.
 */
export function applyDrawEvent(canvas, data) {
  if (!canvas) return;
  const c = ctx2d(canvas);

  if (SHAPE_TOOLS.has(data.tool)) {
    drawShape(
      c,
      data.tool,
      data.x0,
      data.y0,
      data.x1,
      data.y1,
      data.color || "#000",
      data.size || 2,
    );
    return;
  }

  switch (data.tool) {
    case "text":
      commitTextToCanvas(
        canvas,
        data.x,
        data.y,
        data.text || "",
        data.color || "#000",
        data.size || 2,
      );
      return;
    case "fill":
      floodFill(canvas, data.x, data.y, data.color || "#000");
      return;
    case "eraser":
      c.save();
      c.globalCompositeOperation = "destination-out";
      c.lineWidth = (data.size || 2) * 3;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(data.x0, data.y0);
      c.lineTo(data.x1, data.y1);
      c.stroke();
      c.restore();
      return;
    default: // pen
      c.save();
      c.globalCompositeOperation = "source-over";
      c.strokeStyle = data.color || "#000";
      c.lineWidth = data.size || 2;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(data.x0, data.y0);
      c.lineTo(data.x1, data.y1);
      c.stroke();
      c.restore();
  }
}
