#!/usr/bin/env bash
# Serve point_map on http://localhost:8080
# ES modules will not load from a file:// path, so a tiny static server is required.
set -euo pipefail

PORT="${1:-8080}"
cd "$(dirname "$0")"

echo "point_map → http://localhost:${PORT}"
echo "Press Ctrl+C to stop."

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT"
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes serve -l "$PORT" .
else
  echo "Need python3 or npx to serve the folder." >&2
  exit 1
fi
