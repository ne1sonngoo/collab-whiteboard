/**
 * PresenceList.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows a row of colored avatar circles for every user currently on the board.
 * Hovering an avatar shows a tooltip with the user's name.
 *
 * Positioned in the top-right corner, fixed to the viewport so it stays
 * visible regardless of zoom/pan state.
 *
 * Props:
 *   users    — array of { userId, username, color } from usePresence
 *   myUserId — the current client's userId, used to label "you" in the tooltip
 */
import { useState } from "react";

export default function PresenceList({ users, myUserId }) {
  // Track which avatar is being hovered so we can show its tooltip
  const [hoveredId, setHoveredId] = useState(null);

  // Don't render anything until at least one user is present
  if (!users.length) return null;

  return (
    <div style={containerStyle}>
      {users.map((user) => (
        <div
          key={user.userId}
          style={avatarWrapperStyle}
          onMouseEnter={() => setHoveredId(user.userId)}
          onMouseLeave={() => setHoveredId(null)}
        >
          {/* Colored circle — uses the same color assigned by the server */}
          <div
            style={{
              ...avatarStyle,
              background: user.color,
              // Slightly larger ring around the current user's avatar
              boxShadow: user.userId === myUserId
                ? `0 0 0 2px white, 0 0 0 4px ${user.color}`
                : "0 1px 4px rgba(0,0,0,0.2)",
            }}
          >
            {/* First letter of username as the avatar initial */}
            {(user.username || "U")[0].toUpperCase()}
          </div>

          {/* Tooltip — only visible on hover */}
          {hoveredId === user.userId && (
            <div style={tooltipStyle}>
              {user.username || "User"}
              {/* Label the current client's own avatar */}
              {user.userId === myUserId && (
                <span style={youBadgeStyle}> (you)</span>
              )}
            </div>
          )}
        </div>
      ))}

      {/* User count badge — shown when there are multiple users */}
      {users.length > 1 && (
        <div style={countStyle}>
          {users.length} online
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// Outer fixed container — top-right, above the canvas, below nothing
const containerStyle = {
  position: "fixed",
  top: 66,   // pushed below the toolbar (which ends at ~62px from top)
  right: 20,
  zIndex: 1001,              // above the toolbar (1000) so nothing overlaps it
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "rgba(255,255,255,0.85)",
  backdropFilter: "blur(10px)",
  padding: "5px 10px",
  borderRadius: 20,
  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  border: "1px solid rgba(0,0,0,0.06)",
};

// Wrapper around each avatar — relative so the tooltip can be absolutely placed
const avatarWrapperStyle = {
  position: "relative",
  cursor: "default",
};

// The colored circle itself
const avatarStyle = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 700,
  color: "white",
  userSelect: "none",
  // Slight overlap when multiple avatars appear side by side
  marginLeft: -4,
};

// Tooltip that appears above the avatar on hover
const tooltipStyle = {
  position: "absolute",
  top: 36,          // just below the avatar circle
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(0,0,0,0.75)",
  color: "white",
  fontSize: 11,
  padding: "3px 8px",
  borderRadius: 6,
  whiteSpace: "nowrap",
  pointerEvents: "none", // don't interfere with mouse events on the canvas
};

const youBadgeStyle = {
  opacity: 0.7,
  fontStyle: "italic",
};

const countStyle = {
  fontSize: 11,
  color: "#666",
  marginLeft: 4,
  whiteSpace: "nowrap",
};