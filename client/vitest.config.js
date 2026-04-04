/**
 * vitest.config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Vitest configuration for the whiteboard client.
 * Place this at: client/vitest.config.js
 *
 * Key addition over the previous version:
 *   setupFiles — runs vitest-canvas-mock before every test file so jsdom's
 *   canvas.getContext("2d") returns a real mock instead of null.
 *   Without this, all canvas API calls crash immediately.
 *
 * Install dependencies:
 *   npm install -D vitest @vitest/coverage-v8 vitest-canvas-mock
 *
 * Run:
 *   npx vitest run          — single pass (CI)
 *   npx vitest              — watch mode
 *   npx vitest --coverage   — with HTML coverage report in coverage/
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom simulates a browser environment (document, window, HTMLElement, etc.)
    // vitest-canvas-mock (loaded via setupFiles below) patches jsdom's canvas API
    // so getContext("2d") returns a functional mock rather than null.
    environment: "jsdom",

    // Runs once before all test files — patches HTMLCanvasElement.getContext
    // so every test file that imports drawingUtils gets a working canvas mock.
    setupFiles: ["vitest-canvas-mock"],

    // Match any file ending in .test.js or .spec.js under src/
    include: ["src/**/*.{test,spec}.{js,jsx}"],

    // Print every test name (pass and fail), not just failures
    reporter: "verbose",

    coverage: {
      // v8 uses Node's built-in V8 coverage — faster than istanbul, no instrumentation
      provider: "v8",
      // Only report coverage for utility functions — hooks and components need
      // React Testing Library which is a separate setup
      include: ["src/utils/**"],
      // Exclude test files themselves from the coverage report
      exclude: ["src/**/*.test.{js,jsx}"],
      // Human-readable HTML report in coverage/ plus a terminal summary
      reporter: ["text", "html"],
    },
  },
});
