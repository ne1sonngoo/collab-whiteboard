/**
 * Convert pointer event coordinates to canvas pixel coordinates.
 */
export function getCanvasCoords(e, canvas) {
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

/**
 * Convert canvas pixel coordinates to screen coordinates (for overlays).
 */
export function toScreenCoords(x, y, canvas) {
  if (!canvas) return { x, y };
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / canvas.width;
  const scaleY = rect.height / canvas.height;
  return {
    x: x * scaleX,
    y: y * scaleY,
  };
}
