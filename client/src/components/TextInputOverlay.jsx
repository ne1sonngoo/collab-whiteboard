/**
 * TextInputOverlay.jsx
 * Floating textarea that appears when the Text tool is active.
 * Positioned inside the zoom/pan transform wrapper so it scales correctly.
 */
import { CANVAS_W, CANVAS_H } from "../constants";

export default function TextInputOverlay({
  textInput,       // { cx, cy, value } | null
  textareaRef,
  scale,
  color,
  size,
  onChange,
  onKeyDown,
  onBlur,
}) {
  if (!textInput) return null;

  const fontSize = `${Math.max(12, size * 8) / scale}px`;

  return (
    <textarea
      ref={textareaRef}
      value={textInput.value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      onPointerDown={(e) => e.stopPropagation()}
      placeholder="Type here…  Enter=commit  Esc=cancel"
      style={{
        position: "absolute",
        left:      `${(textInput.cx / CANVAS_W) * 100}%`,
        top:       `${(textInput.cy / CANVAS_H) * 100}%`,
        minWidth:  120,
        minHeight: 40,
        background: "rgba(255,255,255,0.9)",
        border: "1.5px dashed #555",
        borderRadius: 3,
        outline: "none",
        padding: "4px 6px",
        fontSize,
        fontFamily: "sans-serif",
        color,
        resize: "both",
        zIndex: 30,
      }}
    />
  );
}