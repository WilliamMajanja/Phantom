#!/usr/bin/env python3
"""Local PHANTOM pattern generator backed by Ollama.

The Node backend expects this script to write exactly one JSON document to stdout.
All diagnostics therefore go to stderr.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/generate")
MODEL = os.environ.get("OLLAMA_MODEL", "llama3:8b-instruct-q4_K_M")
DEFAULT_BPM = int(os.environ.get("PHANTOM_DEFAULT_BPM", "135"))
VALID_TYPES = {
    "kick",
    "snare",
    "hihat_closed",
    "hihat_open",
    "bass_fm",
    "tom_low",
    "tom_mid",
    "tom_high",
    "rim_shot",
    "hand_clap",
    "crash",
    "ride",
    "bass_sub_808",
    "fx_glitch",
}

def log(message: str) -> None:
    print(message, file=sys.stderr)


def post_json(url: str, payload: dict[str, Any], timeout: int = 45) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def normalize_steps(raw_steps: Any) -> list[int]:
    steps = raw_steps if isinstance(raw_steps, list) else []
    normalized: list[int] = []
    for step in steps[:16]:
        if isinstance(step, dict):
            normalized.append(1 if step.get("active") else 0)
        else:
            normalized.append(1 if bool(step) else 0)
    while len(normalized) < 16:
        normalized.append(0)
    return normalized


def sanitize_pattern(pattern: Any, mood: str, bpm: int) -> dict[str, Any]:
    if not isinstance(pattern, dict):
        raise ValueError("OLLAMA_PATTERN_NOT_OBJECT")

    safe_bpm = pattern.get("bpm", bpm)
    if not isinstance(safe_bpm, (int, float)) or safe_bpm < 40 or safe_bpm > 240:
        safe_bpm = bpm

    tracks = []
    for index, track in enumerate(pattern.get("tracks", [])):
        if not isinstance(track, dict):
            continue
        track_type = str(track.get("type", "kick")).lower()
        if track_type not in VALID_TYPES:
            track_type = "kick" if index == 0 else "hihat_closed"
        params = track.get("params") if isinstance(track.get("params"), dict) else {}
        tracks.append(
            {
                "name": str(track.get("name") or track_type).upper()[:32],
                "type": track_type,
                "steps": normalize_steps(track.get("steps")),
                "pan": max(-1, min(1, float(track.get("pan", 0) or 0))),
                "params": {
                    "volume": max(0, min(1, float(params.get("volume", 0.8) or 0.8))),
                    "decay": max(0.01, min(4, float(params.get("decay", 0.5) or 0.5))),
                    "pitch": max(20, min(4000, float(params.get("pitch", 100) or 100))),
                    "tone": max(0, min(1, float(params.get("tone", 0.5) or 0.5))),
                    "filterCutoff": max(20, min(20000, float(params.get("filterCutoff", 2000) or 2000))),
                },
            }
        )

    if not tracks:
        raise ValueError("OLLAMA_PATTERN_EMPTY")
    return {"bpm": int(safe_bpm), "swing": pattern.get("swing", 0), "tracks": tracks[:8]}


def summon_pattern(mood: str = "dark industrial", bpm: int = DEFAULT_BPM) -> dict[str, Any]:
    prompt = f"""
You are the PHANTOM Drum Machine Sequencer running locally through Ollama.
Create a tight 16-step pattern for this request: {mood}
Tempo target: {bpm} BPM.
Return ONLY valid JSON with this schema:
{{
  "bpm": number,
  "swing": number,
  "tracks": [
    {{"name":"KICK_CORE","type":"kick","steps":[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],"pan":0,"params":{{"volume":0.9,"decay":0.5,"pitch":50,"tone":0.2,"filterCutoff":1000}}}}
  ]
}}
Use only these track types: {', '.join(sorted(VALID_TYPES))}.
"""
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.75, "num_ctx": 4096},
    }
    data = post_json(OLLAMA_URL, payload)
    response_text = data.get("response")
    if not response_text:
        raise ValueError("OLLAMA_EMPTY_RESPONSE")
    return sanitize_pattern(json.loads(response_text), mood, bpm)


if __name__ == "__main__":
    mood_arg = sys.argv[1] if len(sys.argv) > 1 else "dark industrial"
    try:
        bpm_arg = int(float(sys.argv[2])) if len(sys.argv) > 2 else DEFAULT_BPM
    except ValueError:
        bpm_arg = DEFAULT_BPM
    try:
        print(json.dumps(summon_pattern(mood_arg[:500], bpm_arg), separators=(",", ":")))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError, ValueError) as exc:
        log(
            f"Ollama pattern generation unavailable: {type(exc).__name__}: {exc}. "
            f"Ensure Ollama is running and reachable at OLLAMA_URL={OLLAMA_URL}."
        )
        raise SystemExit(1)
