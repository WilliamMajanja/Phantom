
import os
import subprocess
import time
import requests
import json

# ==========================================
# PHANTOM AI GHOST: OLLAMA & NPU BRIDGE
# ==========================================
# This script manages the local LLM (Ollama) and ensures 
# the Hailo-8L NPU is available for auxiliary AI tasks.

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3" # Default model

def check_ollama():
    """Check if Ollama is running, start it if not."""
    try:
        requests.get("http://localhost:11434")
        print("✅ OLLAMA SERVICE DETECTED")
    except requests.exceptions.ConnectionError:
        print("⏳ STARTING OLLAMA SERVICE...")
        subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(5)

def check_hailo():
    """Check if Hailo NPU is detected."""
    try:
        result = subprocess.run(["hailortcli", "scan"], capture_output=True, text=True)
        if "Device" in result.stdout:
            print("✅ HAILO-8L NPU DETECTED")
            return True
        else:
            print("⚠️ HAILO NPU NOT FOUND (Check DT Overlays)")
            return False
    except FileNotFoundError:
        print("⚠️ HAILORTCLI NOT INSTALLED")
        return False

def query_ghost(prompt):
    """Query the local LLM (Ollama)."""
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False
    }
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        return response.json().get("response", "No response from Ghost.")
    except Exception as e:
        return f"❌ GHOST ERROR: {e}"

if __name__ == "__main__":
    print("👻 INITIALIZING PHANTOM AI GHOST...")
    check_ollama()
    check_hailo()
    
    # Example usage
    test_prompt = "Suggest a dark techno chord progression."
    print(f"\nPROMPT: {test_prompt}")
    print(f"GHOST: {query_ghost(test_prompt)}")
