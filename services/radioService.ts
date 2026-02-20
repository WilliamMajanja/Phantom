import { shadowCore } from "./audio/ShadowCore";

export interface RadioMessage {
  type: string;
  payload: any;
  from?: string;
  frequency?: string;
}

class RadioService {
  private socket: WebSocket | null = null;
  private nodeId: string = `NODE_${Math.floor(Math.random() * 10000)}`;
  private currentFrequency: string = "101.1";
  private onMessageCallbacks: Set<(msg: RadioMessage) => void> = new Set();

  public connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    this.socket = new WebSocket(`${protocol}//${host}`);

    this.socket.onopen = () => {
      console.log(`[Radio] Connected as ${this.nodeId}`);
      this.joinFrequency(this.currentFrequency);
    };

    this.socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      
      if (msg.type === "RADIO_RECEPTION") {
        this.onMessageCallbacks.forEach(cb => cb(msg));
      }

      if (msg.type === "LORA_VOICE_RECEPTION") {
        this.handleLoRaVoice(msg.payload);
      }
    };

    this.socket.onclose = () => {
      setTimeout(() => this.connect(), 3000);
    };
  }

  public joinFrequency(freq: string) {
    this.currentFrequency = freq;
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: "JOIN_FREQ",
        frequency: freq
      }));
    }
  }

  public transmit(payload: any) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: "RADIO_TRANSMISSION",
        nodeId: this.nodeId,
        payload
      }));
    }
  }

  public transmitLoRaVoice(audioData: string) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: "LORA_VOICE",
        nodeId: this.nodeId,
        payload: audioData
      }));
    }
  }

  private handleLoRaVoice(payload: string) {
    // In a real app, we'd decode the audio and play it
    // For simulation, we'll trigger a visual indicator or a short beep
    console.log("[LoRa] Incoming voice transmission...");
    // shadowCore.playLoRaBeep(); // Future implementation
  }

  public onMessage(cb: (msg: RadioMessage) => void) {
    this.onMessageCallbacks.add(cb);
    return () => this.onMessageCallbacks.delete(cb);
  }

  public getNodeId() {
    return this.nodeId;
  }
}

export const radioService = new RadioService();
