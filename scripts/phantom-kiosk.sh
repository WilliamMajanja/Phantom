#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${PHANTOM_ENV_FILE:-/etc/phantom/phantom.env}"

if [[ -r "${ENV_FILE}" ]]; then
  # The env file location is intentionally configurable for alternate Pi images.
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

PORT="${PORT:-3000}"
PHANTOM_URL="${PHANTOM_URL:-http://localhost:${PORT}}"

if command -v chromium-browser >/dev/null 2>&1; then
  exec chromium-browser --app="${PHANTOM_URL}" --start-fullscreen --noerrdialogs --disable-infobars
fi

if command -v chromium >/dev/null 2>&1; then
  exec chromium --app="${PHANTOM_URL}" --start-fullscreen --noerrdialogs --disable-infobars
fi

echo "Chromium is required to launch the PHANTOM kiosk UI." >&2
exit 1
