# Dockerfile
# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage build — three stages keep the final image small and fast to build.
#
#   Stage 1 (deps)    — install npm dependencies, cached separately from source
#   Stage 2 (builder) — compile the Vite/React app into static files
#   Stage 3 (runtime) — production image: Nginx on port 80 + Node on port 3001
#
# Config files are COPY'd in as separate files (nginx.conf, supervisord.conf)
# rather than written via heredocs — heredoc content gets misread as Dockerfile
# instructions by some parsers and editors.
#
# Expected project layout:
#   collab-whiteboard/
#   ├── client/          (Vite + React)
#   ├── server/          (Node WebSocket server)
#   ├── nginx.conf       (Nginx site config)
#   ├── supervisord.conf (process manager config)
#   └── Dockerfile       (this file)
#
# Build:  docker build -t whiteboard .
# Run:    docker run -p 80:80 -p 3001:3001 whiteboard
# ─────────────────────────────────────────────────────────────────────────────


# ── Stage 1: Install dependencies ────────────────────────────────────────────
# node:22-alpine — current LTS, minimal attack surface, ~60 MB base
FROM node:22-alpine AS deps

WORKDIR /app

# Copy only the package manifests first so Docker can cache this layer.
# npm ci only re-runs when package.json or package-lock.json changes,
# not on every source file edit.
COPY client/package.json client/package-lock.json* ./client/
COPY server/package.json server/package-lock.json* ./server/

# Install client dependencies
RUN cd client && npm ci

# Install server dependencies — omit devDependencies (e.g. nodemon) at runtime
RUN cd server && npm ci --omit=dev


# ── Stage 2: Build the React client ──────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Pull in the installed node_modules from the deps stage (avoids re-installing)
COPY --from=deps /app/client/node_modules ./client/node_modules

# Copy the full client source code
COPY client/ ./client/

# Run Vite's production build — outputs hashed JS/CSS bundles to client/dist/
RUN cd client && npm run build


# ── Stage 3: Production runtime ───────────────────────────────────────────────
# Uses node:22-alpine as the base so we can run Node directly.
# Nginx and supervisord are added via apk.
FROM node:22-alpine AS runtime

LABEL name="collab-whiteboard"
LABEL description="Real-time collaborative whiteboard — React + Node WebSockets"

# Install nginx (serves the React app) and supervisor (manages both processes)
# --no-cache avoids storing the apk index, keeping this layer small
RUN apk add --no-cache nginx supervisor

# Create a non-root user for the Node process
# Nginx runs as its own nginx user (configured in nginx.conf)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# ── Copy the WebSocket server ─────────────────────────────────────────────────
# Only the runtime artefacts — no source maps, no devDependencies
COPY --from=deps    /app/server/node_modules ./server/node_modules
COPY                server/server.js         ./server/server.js

# ── Copy the built React app ──────────────────────────────────────────────────
# The dist/ folder contains index.html + hashed static bundles.
# Build tools (Vite, TypeScript, etc.) stay out of the production image.
COPY --from=builder /app/client/dist ./client/dist

# ── Copy config files ─────────────────────────────────────────────────────────
# Written as separate files rather than inline heredocs to avoid Dockerfile
# parser errors (heredoc content is misread as Dockerfile instructions).
COPY nginx.conf      /etc/nginx/http.d/default.conf
COPY supervisord.conf /etc/supervisord.conf

# Fix Nginx temp directory ownership so it can write pid/cache files
RUN mkdir -p /var/lib/nginx/tmp && \
    chown -R nginx:nginx /var/lib/nginx && \
    # Give appuser ownership of the app files
    chown -R appuser:appgroup /app

# Expose the two ports this container listens on
EXPOSE 80    
EXPOSE 3001  

# Health check — wget checks Nginx is serving the React app every 30 seconds.
# After 3 failures Docker marks the container unhealthy.
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:80 > /dev/null || exit 1

# supervisord is PID 1 — it starts and monitors both nginx and node
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]