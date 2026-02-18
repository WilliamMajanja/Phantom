
#!/bin/bash

# ==========================================
# PHANTOM BOOT THEME INSTALLER
# ==========================================
# Installs the custom Plymouth theme for a graphical boot.
# Usage: sudo ./setup_boot_theme.sh

THEME_DIR="/usr/share/plymouth/themes/phantom"
SOURCE_DIR="./scripts/plymouth"

if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (sudo)"
  exit
fi

echo "🎨 Installing Phantom Boot Theme..."

# 1. Install Dependencies
apt-get install -y plymouth plymouth-themes

# 2. Create Directory
mkdir -p $THEME_DIR

# 3. Copy Assets
# We assume 'phantom_logo.png' exists in the public web folder, 
# we copy it to the theme folder as 'logo.png'
if [ -f "public/phantom_logo.png" ]; then
    cp public/phantom_logo.png $THEME_DIR/logo.png
    echo "✅ Logo Copied."
else
    echo "⚠️  Warning: public/phantom_logo.png not found. Please place the logo file there."
fi

cp $SOURCE_DIR/phantom.plymouth $THEME_DIR/
cp $SOURCE_DIR/phantom.script $THEME_DIR/

# 4. Register Theme
update-alternatives --install /usr/share/plymouth/themes/default.plymouth default.plymouth $THEME_DIR/phantom.plymouth 100

# 5. Set as Default
update-alternatives --set default.plymouth $THEME_DIR/phantom.plymouth

# 6. Rebuild Initramfs (Crucial Step)
echo "⚙️  Rebuilding Initramfs (This takes a minute)..."
update-initramfs -u

echo "✅ Boot Theme Installed. Reboot to view."
