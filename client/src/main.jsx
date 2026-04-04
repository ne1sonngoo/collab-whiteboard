/**
 * main.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Application entry point. Mounts the React tree into the DOM.
 *
 * ErrorBoundary wraps the entire app so any uncaught render error shows a
 * friendly recovery screen instead of a blank white page.
 * See components/ErrorBoundary.jsx for the fallback UI.
 *
 * React.StrictMode is kept enabled intentionally — it double-invokes effects
 * in development to surface bugs (like stale closures) that would otherwise
 * only appear in production. The harmless "WebSocket closed before connection"
 * console warning it produces is suppressed in useSocket.js.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

// Mount the React app into the #root div defined in index.html
createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/*
      ErrorBoundary sits at the very top of the tree so it catches any error
      thrown by any component — including Canvas, hooks, and sub-components.
      If the board crashes, the user sees a "Try again / Refresh" screen
      rather than a blank page with no explanation.
    */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);