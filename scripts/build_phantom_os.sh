
#!/bin/bash

# ==========================================
# PHANTOM OS: IMAGE FORGER v1.2
# ==========================================
# Transforms Raspberry Pi OS Lite into PhantomOS.
# Usage: sudo ./build_phantom_os.sh [PI5|LEGACY]
#   PI5:    Optimized for NVMe, PCIe Gen 3, and Overclocking.
#   LEGACY: Safe settings for Pi 3B+ and Pi 4.

TARGET_MODEL=${1:-PI5} # Default to PI5 if not specified
IMAGE_NAME="PhantomOS_v1.2_${TARGET_MODEL}.img"
SOURCE_URL="https://downloads.raspberrypi.com/raspios_lite_arm64/images/raspios_lite_arm64-2024-03-15/2024-03-15-raspios-bookworm-arm64-lite.img.xz"
SOURCE_IMG="2024-03-15-raspios-bookworm-arm64-lite.img"
MOUNT_POINT="/mnt/phantom_os"

# Check for root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (sudo)"
  exit
fi

echo "💀 PHANTOM PROTOCOL INITIATED..."
echo "🎯 TARGET ARCHITECTURE: $TARGET_MODEL"

# 1. DOWNLOAD BASE IMAGE
if [ ! -f "$SOURCE_IMG" ]; then
    echo "⬇️  Downloading Base Image (Raspberry Pi OS Lite)..."
    wget -O base.img.xz $SOURCE_URL
    echo "📦 Extracting..."
    unxz base.img.xz
    mv base.img $SOURCE_IMG
fi

# Copy to target to preserve original
cp $SOURCE_IMG $IMAGE_NAME

# 2. MOUNT THE IMAGE
# Calculate offset for the root partition (Partition 2)
echo "🔌 Mounting Filesystem..."
mkdir -p $MOUNT_POINT
# Note: Offsets may vary by image version. Ensure these match the downloaded image `fdisk -l`.
# Typically start sectors: Boot=8192, Root=532480. Sector size=512.
mount -o loop,offset=$((532480*512)) $IMAGE_NAME $MOUNT_POINT
mount -o loop,offset=$((8192*512)) $IMAGE_NAME $MOUNT_POINT/boot/firmware

# 3. INJECT SYSTEM CONFIGURATION (config.txt)
echo "⚡ Injecting Hardware Profile..."

cat <<EOF > $MOUNT_POINT/boot/firmware/config.txt
# PHANTOM HARDWARE PROFILE [$TARGET_MODEL]
arm_64bit=1

# Audio & GPIO
dtparam=audio=on
# dtoverlay=hifiberry-dac # Uncomment if using DAC HAT
dtoverlay=i2c-baudrate=400000

# Boot Visuals
disable_splash=1
boot_delay=0
gpu_mem=256
EOF

if [ "$TARGET_MODEL" == "PI5" ]; then
    echo "🚀 Applying Pi 5 NVMe & Overclock Settings..."
    cat <<EOF >> $MOUNT_POINT/boot/firmware/config.txt

# --- PI 5 SPECIFIC ---
arm_freq=2600
gpu_freq=900
over_voltage_delta=50000

# NVMe / PCIe Gen 3 Optimization
dtparam=pciex1
dtparam=pciex1_gen=3
EOF
else
    echo "🛡️ Applying Legacy Safe Mode Settings..."
    cat <<EOF >> $MOUNT_POINT/boot/firmware/config.txt

# --- LEGACY SPECIFIC (Pi 3/4) ---
# Moderate Overclock for Pi 4
# arm_freq=2000
# over_voltage=6
EOF
fi

# 4. SILENT BOOT (cmdline.txt)
echo "🤫 Silencing Kernel..."
# Strip out existing console params and add quiet ones
NEW_CMD="console=serial0,115200 root=PARTUUID=something rootfstype=ext4 fsck.repair=yes rootwait quiet splash plymouth.ignore-serial-consoles logo.nologo vt.global_cursor_default=0 loglevel=0"
echo $NEW_CMD > $MOUNT_POINT/boot/firmware/cmdline.txt

# 5. SETUP CHROOT ENVIRONMENT
echo "🔧 Preparing Chroot..."
mount --bind /dev $MOUNT_POINT/dev
mount --bind /sys $MOUNT_POINT/sys
mount --bind /proc $MOUNT_POINT/proc
mount --bind /etc/resolv.conf $MOUNT_POINT/etc/resolv.conf

# 6. INSTALL PHANTOM STACK
echo "📦 Installing Software Stack..."
chroot $MOUNT_POINT /bin/bash <<EOF

export DEBIAN_FRONTEND=noninteractive

# Update & Install Dependencies
apt-get update
apt-get install -y \
    wayfire \
    chromium-browser \
    nodejs \
    npm \
    python3-pip \
    python3-venv \
    git \
    plymouth \
    plymouth-themes \
    pipewire \
    pipewire-pulse \
    wireplumber \
    alsa-utils \
    fonts-jetbrains-mono \
    rpi-eeprom

# Create Phantom Directory
mkdir -p /opt/phantom
# Note: In a real run, you would git clone here. 
# Since we are local, we assume copying or cloning logic exists.

# Install Boot Theme logic is handled by setup_boot_theme.sh inside the OS usually,
# but we can prep the folders here if we copied the files into the mount point.

# Create System Service
cat <<SERVICE > /etc/systemd/system/phantom.service
[Unit]
Description=Phantom Protocol
After=network.target sound.target

[Service]
User=root
Group=root
Type=simple
Environment=DISPLAY=:0
Environment=WAYLAND_DISPLAY=wayland-0
ExecStart=/opt/phantom/scripts/reflex-os.sh
Restart=always

[Install]
WantedBy=multi-user.target
SERVICE

systemctl enable phantom.service

EOF

# 7. CLEANUP
echo "🧹 Cleaning up..."
umount $MOUNT_POINT/dev
umount $MOUNT_POINT/sys
umount $MOUNT_POINT/proc
umount $MOUNT_POINT/boot/firmware
umount $MOUNT_POINT

echo "✅ PHANTOM OS FORGED: $IMAGE_NAME"
echo "👉 Flash this image to your SD Card (Legacy) or NVMe Drive (Pi 5)."
