// vite.config.js
// ─────────────────────────────────────────────────────────────────────────────
// Vite build configuration for the React whiteboard client.
//
// Key responsibilities:
//   • Enable the React plugin so JSX and Fast Refresh work
//   • Proxy WebSocket connections in development so the browser can reach the
//     Node server on port 3001 without CORS issues
//   • Expose an environment variable (VITE_WS_URL) so the WebSocket URL can
//     be overridden at build time for different environments (local, Docker, cloud)
//   • Configure the production build output directory
// ─────────────────────────────────────────────────────────────────────────────

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Load .env, .env.local, .env.[mode] files from the project root.
  // The third argument "" means load all variables (not just VITE_ prefixed ones).
  const env = loadEnv(mode, process.cwd(), "");

  return {
    // ── Plugins ───────────────────────────────────────────────────────────────
    plugins: [
      // @vitejs/plugin-react enables:
      //   • JSX transform (no need to import React in every file)
      //   • Fast Refresh (components update without losing state during dev)
      react(),
    ],

    // ── Dev server ────────────────────────────────────────────────────────────
    server: {
      // Port the Vite dev server listens on — open http://localhost:5173
      port: 5173,

      // Proxy config: forwards requests from the dev server to the Node server.
      // This avoids cross-origin issues when the client (5173) talks to the
      // WebSocket server (3001) during local development.
      proxy: {
        // Any request to /ws is proxied to the Node WebSocket server.
        // useSocket.js in dev mode connects to "/ws" (relative URL) which Vite
        // transparently forwards to ws://localhost:3001.
        "/ws": {
          target: "ws://localhost:3001", // Node WebSocket server
          ws: true, // enable WebSocket proxying
          rewriteWsOrigin: true, // rewrite the Origin header to avoid rejection
          changeOrigin: true, // match the target's host header
        },
      },
    },

    // ── Build output ──────────────────────────────────────────────────────────
    build: {
      // Output directory — Dockerfile copies this to /app/client/dist in the image
      outDir: "dist",

      // Generate source maps for production so errors in logs are traceable.
      // Set to false if you want a smaller bundle and don't need stack traces.
      sourcemap: false,

      // Warn if any individual chunk exceeds 500 KB after minification
      chunkSizeWarningLimit: 500,

      rollupOptions: {
        output: {
          // Split vendor libraries into a separate chunk so they can be cached
          // by the browser independently of your app code changes
          manualChunks: {
            // React and React-DOM are unlikely to change between deployments —
            // splitting them out means users don't re-download them on every release
            react: ["react", "react-dom"],
          },
        },
      },
    },

    // ── Environment variables ─────────────────────────────────────────────────
    // Define constants that are statically replaced at build time.
    // VITE_WS_URL lets you point the client at a different WebSocket server
    // without changing source code — just set the env var before building.
    //
    // Usage in useSocket.js:
    //   const ws = new WebSocket(import.meta.env.VITE_WS_URL || "ws://localhost:3001");
    //
    // Override for Docker/production:
    //   VITE_WS_URL=ws://yourdomain.com:3001 npm run build
    define: {
      __WS_URL__: JSON.stringify(env.VITE_WS_URL || "ws://localhost:3001"),
    },
  };
});
