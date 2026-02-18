
import reflex as rx
import asyncio
import time
import json
from typing import List, Dict

class Message(rx.Base):
    role: str
    text: str
    timestamp: str

class Track(rx.Base):
    id: str
    name: str
    instrument: str
    steps: List[bool]
    mute: bool = False

class State(rx.State):
    """The app state."""
    # Transport
    bpm: int = 120
    playing: bool = False
    active_tab: str = "SEQUENCER"
    
    # Telemetry
    cpu_temp: float = 45.0
    npu_load: float = 12.0
    memory_usage: float = 3.2
    
    # Ghost Bridge (AI Assistant)
    chat_history: List[Message] = [
        Message(role="SYSTEM", text="GHOST_BRIDGE_V2 ONLINE. LINK ESTABLISHED.", timestamp="00:00")
    ]
    current_prompt: str = ""
    is_processing: bool = False
    sidebar_open: bool = False

    # Sequencer Data
    tracks: List[Track] = [
        Track(id="1", name="KICK_CORE", instrument="kick", steps=[True, False, False, False] * 4),
        Track(id="2", name="SNARE_VOID", instrument="snare", steps=[False, False, True, False] * 4),
    ]

    def toggle_play(self):
        self.playing = not self.playing

    def set_tab(self, tab: str):
        self.active_tab = tab

    def toggle_sidebar(self):
        self.sidebar_open = not self.sidebar_open

    @rx.event
    async def handle_chat_submit(self):
        if not self.current_prompt:
            return
        
        # Add user message
        new_msg = Message(
            role="USER", 
            text=self.current_prompt, 
            timestamp=time.strftime("%H:%M")
        )
        self.chat_history.append(new_msg)
        self.is_processing = True
        yield
        
        # Simulate AI Thinking (In production, call interpretSignal here)
        await asyncio.sleep(1)
        
        ai_response = Message(
            role="GHOST",
            text=f"PROTOCOL_EXECUTED // PATTERN_RECONFIGURED // BPM:{self.bpm}",
            timestamp=time.strftime("%H:%M")
        )
        self.chat_history.append(ai_response)
        self.current_prompt = ""
        self.is_processing = False

    def update_step(self, track_id: str, step_idx: int):
        for track in self.tracks:
            if track.id == track_id:
                track.steps[step_idx] = not track.steps[step_idx]
                break

    @rx.background
    async def poll_telemetry(self):
        while True:
            async with self:
                # Mock hardware polling
                import random
                self.cpu_temp = round(45.0 + random.uniform(-2, 2), 1)
                self.npu_load = round(10.0 + random.uniform(0, 15), 1)
            await asyncio.sleep(2)
