
import serial
import adafruit_thermal_printer 
import sys
import qrcode

# PHANTOM PHASE 9: SPIRIT LEDGER PRINTER
# Hardware: Mini Thermal Printer (TTL)
# Wiring: GPIO 14 (TX) -> RX, GPIO 15 (RX) -> TX

# Mock class if hardware is missing to prevent crash
class MockPrinter:
    def __getattr__(self, name):
        return lambda *args: None

try:
    # Raspberry Pi 5 UART 0
    uart = serial.Serial("/dev/serial0", baudrate=19200, timeout=3000)
    printer = adafruit_thermal_printer.get_printer_class(2.69)(uart)
    print("🖨️  Spirit Printer Linked.")
except:
    print("⚠️  Printer Hardware Not Found. Using Mock.")
    printer = MockPrinter()

def print_provenance(tx_id, timestamp, hash_val):
    """
    Prints a physical receipt of the blockchain anchor.
    """
    try:
        printer.wake()
        printer.inverse(True)
        printer.justify('C')
        printer.setSize('L')
        printer.print(" P H A N T O M ")
        printer.inverse(False)
        printer.setSize('S')
        printer.feed(1)
        
        printer.print("SPIRIT LEDGER VERIFIED")
        printer.print("--------------------------------")
        printer.justify('L')
        printer.print(f"TIME: {timestamp}")
        printer.print(f"HASH: {hash_val[:12]}...")
        printer.feed(1)
        
        printer.print("TxPoW ID:")
        printer.print(tx_id)
        printer.feed(1)
        
        # QR Code Generation for Minima Explorer
        url = f"https://minima.global/check/{tx_id}"
        printer.print_qr_code(url)
        
        printer.feed(2)
        printer.print("Code is Law.")
        printer.print("Music is Spirit.")
        printer.feed(3)
        printer.sleep()
        print("✅ Receipt Printed.")
        
    except Exception as e:
        print(f"❌ Print Error: {e}")

if __name__ == "__main__":
    # Test Print
    print_provenance("0xTEST_SIG_123456789", "2024-10-27T12:00:00Z", "0xHASH_ABC")
