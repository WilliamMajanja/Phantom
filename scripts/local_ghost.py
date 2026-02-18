
import requests
import json
import sys

# PHANTOM PHASE 8: THE GHOST IN THE SHELL
# Offline Intelligence Node via Ollama (Llama 3 8B)

# Configuration
OLLAMA_URL = "http://localhost:11434/api/generate"
# Fits in Pi 5 16GB RAM (approx 6GB usage)
MODEL = "llama3:8b-instruct-q4_K_M" 

class LocalGhost:
    def __init__(self):
        print("👻 Initializing Local Llama 3 Node...")
        self.verify_connection()

    def verify_connection(self):
        try:
            requests.get(OLLAMA_URL.replace("/api/generate", ""))
            print("✅ Ollama Service Linked.")
        except:
            print("❌ Ollama Offline. Ghost is silent.")

    def summon_pattern(self, mood="dark industrial", bpm=135):
        prompt = f"""
        You are the PHANTOM Drum Machine Sequencer. 
        Role: Industrial Techno Composer.
        Task: Create a 16-step pattern for {mood} style at {bpm} BPM.
        Output: ONLY valid JSON. No Markdown. No chatter.
        Schema:
        {{
            "bpm": {bpm},
            "tracks": [
                {{ "name": "KICK_MAIN", "type": "kick", "steps": [1,0,0,0...], "params": {{ "decay": 0.5, "pitch": 50, "tone": 0.2, "filterCutoff": 1000 }} }},
                {{ "name": "HH_CL", "type": "hihat_closed", "steps": [1,1,1,1...], "params": {{...}} }}
            ]
        }}
        """
        
        payload = {
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json", # Force JSON mode
            "options": {
                "temperature": 0.8,
                "num_ctx": 4096
            }
        }
        
        try:
            print(f"👻 Summoning Pattern: {mood}...")
            response = requests.post(OLLAMA_URL, json=payload)
            data = response.json()
            
            if 'response' in data:
                # Return the raw JSON string for the frontend to parse
                return json.loads(data['response'])
            else:
                return None
                
        except Exception as e:
            print(f"💀 Ghost Silence: {e}")
            return None

if __name__ == "__main__":
    ghost = LocalGhost()
    if len(sys.argv) > 1:
        print(json.dumps(ghost.summon_pattern(sys.argv[1])))
    else:
        print(json.dumps(ghost.summon_pattern()))
