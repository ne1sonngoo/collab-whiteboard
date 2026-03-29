/**
 * ZoomBadge.jsx
 * Small overlay badge showing current zoom level + a Reset button.
 * Only rendered when zoom !== 100%.
 */
export default function ZoomBadge({ scale, onReset }) {
  if (scale === 1) return null;

  return (
    <div style={badgeStyle}>
      {Math.round(scale * 100)}%
      <button onClick={onReset} style={btnStyle}>Reset</button>
    </div>
  );
}

const badgeStyle = {
  position: "absolute", bottom: 12, right: 12, zIndex: 100,
  background: "rgba(0,0,0,0.6)", color: "white",
  padding: "4px 10px", borderRadius: 20, fontSize: 13,
  display: "flex", alignItems: "center", gap: 8,
};
const btnStyle = {
  background: "rgba(255,255,255,0.2)", border: "none",
  color: "white", cursor: "pointer", borderRadius: 10,
  padding: "2px 8px", fontSize: 12,
};