"""Python backend helpers for local PHANTOM runtime integrations."""

from __future__ import annotations

import json
import os
import shutil
import urllib.error
import urllib.request
from dataclasses import dataclass, asdict
from typing import Any

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3:8b-instruct-q4_K_M")


@dataclass(frozen=True)
class EngineStatus:
    name: str
    role: str
    command: str
    available: bool


def production_engines() -> list[dict[str, Any]]:
    return [
        asdict(EngineStatus("LMMS", "production", "lmms", shutil.which("lmms") is not None)),
        asdict(EngineStatus("Mixxx", "mixing", "mixxx", shutil.which("mixxx") is not None)),
    ]


def sample_formats() -> list[dict[str, str]]:
    return [
        {"name": "AKAI MPC Program", "extension": ".mpcprogram.json", "role": "pad and sample map"},
        {"name": "Serato Slab Manifest", "extension": ".serato-slab.json", "role": "crate, slab, and cue metadata"},
    ]


def ask_ollama(prompt: str, bpm: int) -> dict[str, Any]:
    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "format": "json",
        "prompt": (
            "You are PHANTOM's local drum machine AI. Return only JSON with "
            "bpm and a concise response field. Include a tracks array of 16-step "
            f"drum ideas for this request at {bpm} BPM: {prompt[:500]}"
        ),
    }
    request = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            data = json.loads(response.read().decode("utf-8"))
        response_body = data.get("response")
        body = json.loads(response_body) if response_body else {}
        return {
            "online": True,
            "message": body.get("response") or "LOCAL_OLLAMA_PATTERN_READY",
            "pattern": body,
        }
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        return {
            "online": False,
            "message": f"LOCAL_OLLAMA_OFFLINE // FALLBACK_READY // {exc.__class__.__name__}",
            "pattern": {"bpm": bpm, "tracks": []},
        }
