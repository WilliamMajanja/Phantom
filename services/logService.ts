
type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'SYSTEM';

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    source: string;
    message: string;
}

class LogService {
    private logs: LogEntry[] = [];
    private listeners: ((logs: LogEntry[]) => void)[] = [];

    constructor() {
        this.addLog('SYSTEM', 'KERNEL', 'PiNet_Os Kernel v1.2 Initialized');
    }

    public addLog(level: LogLevel, source: string, message: string) {
        const entry: LogEntry = {
            timestamp: new Date().toLocaleTimeString(),
            level,
            source,
            message
        };
        this.logs = [entry, ...this.logs].slice(0, 100);
        this.notify();
    }

    public getLogs() {
        return this.logs;
    }

    public subscribe(callback: (logs: LogEntry[]) => void) {
        this.listeners.push(callback);
        callback(this.logs);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notify() {
        this.listeners.forEach(l => l(this.logs));
    }
}

export const logService = new LogService();
