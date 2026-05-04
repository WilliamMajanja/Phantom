export interface RadioMessage {
  type: string;
  payload: { text?: string; [key: string]: unknown };
  from?: string;
  frequency?: string;
  timestamp?: number;
}

export interface RadioStatus {
  connected: boolean;
  frequency: string;
  peers: number;
  latency: number | null;
  nodeId: string;
  lastSeen: number | null;
}

class RadioService {
  private socket: WebSocket | null = null;
  private nodeId: string = `NODE_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  private currentFrequency: string = "101.1";
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private onMessageCallbacks: Set<(msg: RadioMessage) => void> = new Set();
  private onStatusCallbacks: Set<(status: RadioStatus) => void> = new Set();
  private status: RadioStatus = {
    connected: false,
    frequency: this.currentFrequency,
    peers: 0,
    latency: null,
    nodeId: this.nodeId,
    lastSeen: null
  };

  public connect() {
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    this.socket = new WebSocket(`${protocol}//${host}`);

    this.socket.onopen = () => {
      this.updateStatus({ connected: true, lastSeen: Date.now() });
      this.joinFrequency(this.currentFrequency);
      this.startHeartbeat();
    };

    this.socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.updateStatus({ lastSeen: Date.now() });

      if (msg.type === "RADIO_RECEPTION") {
        this.onMessageCallbacks.forEach(cb => cb(msg));
      }

      if (msg.type === "FREQ_JOINED" || msg.type === "PEER_STATUS") {
        this.updateStatus({
          frequency: String(msg.frequency || this.currentFrequency),
          peers: Number.isFinite(Number(msg.peers)) ? Number(msg.peers) : this.status.peers
        });
      }

      if (msg.type === "PONG") {
        const sentAt = Number(msg.sentAt);
        if (Number.isFinite(sentAt)) {
          this.updateStatus({
            latency: Math.max(0, Date.now() - sentAt),
            peers: Number.isFinite(Number(msg.peers)) ? Number(msg.peers) : this.status.peers
          });
        }
      }

      if (msg.type === "LORA_VOICE_RECEPTION") {
        this.handleLoRaVoice(msg.payload);
      }
    };

    this.socket.onclose = () => {
      this.stopHeartbeat();
      this.updateStatus({ connected: false, peers: 0, latency: null });
      if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = window.setTimeout(() => this.connect(), 3000);
    };

    this.socket.onerror = () => {
      this.updateStatus({ connected: false });
    };
  }

  public joinFrequency(freq: string) {
    this.currentFrequency = freq;
    this.updateStatus({ frequency: freq });
    this.send({
      type: "JOIN_FREQ",
      frequency: freq
    });
  }

  public transmit(payload: string | { text?: string; [key: string]: unknown }) {
    const radioPayload = typeof payload === 'string' ? { text: payload } : payload;
    return this.send({
      type: "RADIO_TRANSMISSION",
      nodeId: this.nodeId,
      payload: radioPayload
    });
  }

  public transmitLoRaVoice(audioData: string) {
    return this.send({
      type: "LORA_VOICE",
      nodeId: this.nodeId,
      payload: audioData
    });
  }

  private handleLoRaVoice(payload: string) {
    console.log("[LoRa] Incoming voice transmission", payload.length);
  }

  private send(payload: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      this.send({ type: "PING", sentAt: Date.now(), frequency: this.currentFrequency });
    }, 5000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private updateStatus(update: Partial<RadioStatus>) {
    this.status = { ...this.status, ...update };
    this.onStatusCallbacks.forEach(cb => cb(this.status));
  }

  public onMessage(cb: (msg: RadioMessage) => void) {
    this.onMessageCallbacks.add(cb);
    return () => this.onMessageCallbacks.delete(cb);
  }

  public onStatus(cb: (status: RadioStatus) => void) {
    this.onStatusCallbacks.add(cb);
    cb(this.status);
    return () => this.onStatusCallbacks.delete(cb);
  }

  public getStatus() {
    return this.status;
  }

  public getNodeId() {
    return this.nodeId;
  }
}

export const radioService = new RadioService();
