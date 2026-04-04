/**
 * constants.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for every magic number, string, and configuration
 * value in the app. Importing from here means you only change a value once
 * and every file that uses it updates automatically.
 */

// ── Canvas dimensions ────────────────────────────────────────────────────────
// The internal pixel resolution of the drawing canvas.
// CSS scales it to fill its container, so these are logical not screen pixels.
export const CANVAS_W = 1400;
export const CANVAS_H = 800;

// ── Tool definitions ─────────────────────────────────────────────────────────
// Each entry drives one toolbar button.
// id    → the string stored in tool state and sent in draw events
// label → emoji / glyph shown on the button
// title → tooltip text on hover
export const TOOLS = [
  { id: "pen", label: "✏️", title: "Pen — freehand drawing" },
  { id: "eraser", label: "🧽", title: "Eraser — removes pixels" },
  { id: "line", label: "╱", title: "Line — drag to draw a straight line" },
  { id: "rect", label: "▭", title: "Rectangle — drag to draw a rectangle" },
  { id: "circle", label: "○", title: "Ellipse — drag to draw an ellipse" },
  {
    id: "text",
    label: "T",
    title: "Text — click canvas to place a text input",
  },
  {
    id: "fill",
    label: "🪣",
    title: "Fill — flood-fill an area with the current color",
  },
  {
    id: "note",
    label: "📝",
    title: "Sticky Note — click canvas to place a note",
  },
];

// Tools that are drawn by dragging from a start point to an end point.
// Used in useDrawing to branch between freehand logic and shape logic.
export const SHAPE_TOOLS = new Set(["rect", "circle", "line"]);

// ── Zoom limits ──────────────────────────────────────────────────────────────
export const ZOOM_MIN = 0.15; // 15%  — minimum zoom level
export const ZOOM_MAX = 8; // 800% — maximum zoom level
export const ZOOM_STEP = 1.1; // multiply / divide scale by this per wheel tick

// ── Undo history ─────────────────────────────────────────────────────────────
// Max number of ImageData snapshots kept in memory per client.
// Each 1400×800 snapshot is ~4.5 MB, so 30 = ~135 MB worst case.
export const MAX_HISTORY = 30;

// ── Flood fill ───────────────────────────────────────────────────────────────
// How closely a pixel's RGBA values must match the seed pixel to be filled.
// 0 = exact match only, 255 = fill everything. 30 handles anti-aliased edges.
export const FILL_TOLERANCE = 30;

// ── Presence colors ───────────────────────────────────────────────────────────
// Cycled through when assigning colors to users in the presence list.
// Also used as the color of that user's remote cursor dot.
export const PRESENCE_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];

// ── WebSocket message types ──────────────────────────────────────────────────
// All socket messages have a `type` field matching one of these strings.
// Centralising them here prevents typos and makes rename-refactoring trivial.
export const MSG = {
  JOIN: "join", // client → server: enter a room
  INIT: "init", // server → client: full board state (on join or after undo/redo)
  DRAW: "draw", // both: a single draw event (stroke, shape, text, fill)
  CLEAR_BOARD: "clear_board", // both: wipe all strokes
  CURSOR_MOVE: "cursor_move", // client → server → others: live cursor position (throttled)
  NOTE_CREATE: "note_create", // both: new sticky note (includes createdBy userId)
  NOTE_MOVE: "note_move", // both: note repositioned
  NOTE_UPDATE: "note_update", // both: note text changed
  NOTE_DELETE: "note_delete", // both: note removed
  UNDO_LAST: "undo_last", // client → server: pop sender's last stroke to their redo stack
  REDO_LAST: "redo_last", // client → server: restore sender's last undone stroke
  ROOM_RENAME: "room_rename", // both: room display name changed
  ROOM_INFO: "room_info", // server → client (on join): current room name
  PRESENCE_UPDATE: "presence_update", // server → all clients: current connected user list
};
