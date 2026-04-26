#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/phantom}"
APP_USER="${APP_USER:-phantom}"
APP_GROUP="${APP_GROUP:-phantom}"
ENV_DIR="/etc/phantom"
ENV_FILE="${ENV_DIR}/phantom.env"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root: sudo bash scripts/install_raspberry_pi_trixie.sh"
  exit 1
fi

if [[ -r /etc/os-release ]]; then
  # shellcheck disable=SC1091
  source /etc/os-release
  if [[ "${VERSION_CODENAME:-}" != "trixie" ]]; then
    # Continue after warning so advanced users can test compatible Raspberry Pi OS derivatives.
    echo "Warning: this installer targets Raspberry Pi OS Trixie; detected '${VERSION_CODENAME:-unknown}'."
  fi
fi

echo "Installing PHANTOM for Raspberry Pi OS Trixie..."

apt-get update
apt-get install -y \
  alsa-utils \
  curl \
  libgpiod-dev \
  nodejs \
  npm \
  pipewire \
  pipewire-audio-client-libraries \
  pipewire-pulse \
  python3 \
  python3-gpiozero \
  python3-pip \
  python3-venv \
  rsync \
  wireplumber

if apt-cache show chromium-browser >/dev/null 2>&1; then
  apt-get install -y chromium-browser
elif apt-cache show chromium >/dev/null 2>&1; then
  apt-get install -y chromium
fi

if ! getent group "${APP_GROUP}" >/dev/null; then
  addgroup --system "${APP_GROUP}"
fi

if ! id "${APP_USER}" >/dev/null 2>&1; then
  adduser --system --home "${APP_DIR}" --ingroup "${APP_GROUP}" --disabled-login "${APP_USER}"
fi

for group in audio video input render gpio spi i2c; do
  if getent group "${group}" >/dev/null; then
    usermod -aG "${group}" "${APP_USER}"
  fi
done

mkdir -p "${APP_DIR}"
install -d -m 0750 -o root -g "${APP_GROUP}" "${ENV_DIR}"
rsync -a --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude "dist" \
  "${REPO_ROOT}/" "${APP_DIR}/"

chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"

cd "${APP_DIR}"
runuser -u "${APP_USER}" -- npm ci
runuser -u "${APP_USER}" -- npm run build

if [[ ! -f "${ENV_FILE}" ]]; then
  cat > "${ENV_FILE}" <<EOF
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
APP_URL=http://localhost:3000
GEMINI_API_KEY=
EOF
fi
chown root:"${APP_GROUP}" "${ENV_FILE}"
chmod 0640 "${ENV_FILE}"

install -m 0644 "${APP_DIR}/scripts/systemd/phantom.service" /etc/systemd/system/phantom.service
install -m 0755 "${APP_DIR}/scripts/phantom-kiosk.sh" /usr/local/bin/phantom-kiosk
install -m 0644 "${APP_DIR}/scripts/desktop/phantom.desktop" /usr/share/applications/phantom.desktop

systemctl daemon-reload
systemctl enable phantom.service
systemctl restart phantom.service

echo "PHANTOM is installed as a Raspberry Pi OS Trixie application."
echo "Service: systemctl status phantom.service"
echo "UI: http://localhost:3000"
