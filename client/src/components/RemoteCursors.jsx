/**
 * RemoteCursors.jsx
 * Renders remote user cursor dots + name labels.
 * Positioned as % of canvas dimensions so they sit correctly inside
 * the zoom/pan transform wrapper.
 */
import { CANVAS_W, CANVAS_H } from "../constants";

export default function RemoteCursors({ cursors, scale }) {
  return Object.entries(cursors).map(([id, cursor]) => (
    <div
      key={id}
      style={{
        position: "absolute",
        left:  `${(cursor.x / CANVAS_W) * 100}%`,
        top:   `${(cursor.y / CANVAS_H) * 100}%`,
        pointerEvents: "none",
        zIndex: 5,
        // Counter-scale so dot + label stay the same screen size regardless of zoom
        transform: `scale(${1 / scale})`,
        transformOrigin: "0 0",
      }}
    >
      <div style={{ ...dotStyle, background: cursor.color }} />
      <div style={labelStyle}>{cursor.username || "User"}</div>
    </div>
  ));
}

const dotStyle = {
  width: 12, height: 12, borderRadius: "50%",
};
const labelStyle = {
  position: "absolute", top: 14, left: 0,
  fontSize: 12, background: "black", color: "white",
  padding: "2px 6px", borderRadius: 6, whiteSpace: "nowrap",
};