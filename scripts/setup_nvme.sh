
#!/bin/bash

# ==========================================
# PHANTOM: NVMe HYPERSPEED PROTOCOL
# ==========================================
# Configures Raspberry Pi 5 for PCIe Gen 3 and NVMe Boot Priority.
# Usage: sudo ./setup_nvme.sh

if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (sudo)"
  exit
fi

# Detect Model
MODEL=$(cat /proc/cpuinfo | grep Model | cut -d ':' -f 2)

if [[ "$MODEL" != *"Raspberry Pi 5"* ]]; then
    echo "⚠️  Hardware Mismatch: $MODEL detected."
    echo "🛑 NVMe Optimization Protocol is only for Raspberry Pi 5."
    echo "   Skipping PCIe Gen 3 configuration to prevent system instability."
    exit 0
fi

echo "🚀 INITIALIZING NVMe OPTIMIZATION FOR PI 5..."

# 1. ENABLE PCIe GEN 3 IN CONFIG.TXT
CONFIG="/boot/firmware/config.txt"
if grep -q "dtparam=pciex1_gen=3" "$CONFIG"; then
    echo "✅ PCIe Gen 3 already enabled."
else
    echo "⚙️  Enabling PCIe Gen 3..."
    echo "" >> $CONFIG
    echo "# PHANTOM NVMe OPTIMIZATION" >> $CONFIG
    echo "dtparam=pciex1" >> $CONFIG
    echo "dtparam=pciex1_gen=3" >> $CONFIG
    echo "✅ Config updated."
fi

# 2. UPDATE BOOTLOADER ORDER (NVMe Priority)
# Standard: 0xf41
# Phantom: 0xf416 (NVMe -> SD -> USB)
echo "⚙️  Updating Bootloader EEPROM..."
rpi-eeprom-config > boot.conf
sed -i 's/BOOT_ORDER=.*/BOOT_ORDER=0xf416/' boot.conf
rpi-eeprom-config --apply boot.conf
rm boot.conf

echo "✅ Boot Order Updated: NVMe -> SD -> USB"

# 3. VERIFY DRIVE
echo "🔍 Scanning PCIe Bus..."
lspci | grep "Non-Volatile memory controller"

echo "---------------------------------------------------"
echo "⚠️  WARNING: PCIe Gen 3 requires a certified FPC cable."
echo "👉 REBOOT SYSTEM TO ENGAGE."
echo "---------------------------------------------------"
