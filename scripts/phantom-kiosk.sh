#!/usr/bin/env bash
set -euo pipefail

PHANTOM_URL="${PHANTOM_URL:-http://localhost:${PORT:-3000}}"

if command -v chromium-browser >/dev/null 2>&1; then
  exec chromium-browser --app="${PHANTOM_URL}" --start-fullscreen --noerrdialogs --disable-infobars
fi

if command -v chromium >/dev/null 2>&1; then
  exec chromium --app="${PHANTOM_URL}" --start-fullscreen --noerrdialogs --disable-infobars
fi

echo "Chromium is required to launch the PHANTOM kiosk UI." >&2
exit 1
