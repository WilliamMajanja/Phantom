
import { TelemetryData } from '../types';

/**
 * Telemetry Service — Real Browser Metrics
 * 
 * Replaces random simulated telemetry with actual browser/system metrics
 * where available via the Performance API and navigator APIs.
 * Falls back to estimation for metrics not available in the browser.
 */

class TelemetryService {
    private lastCPUMeasurement: { idle: number; total: number } | null = null;

    /**
     * Collect real telemetry data from browser APIs.
     * On a Pi running Chromium, many of these will reflect actual system state.
     */
    public async collect(serverCpuTemp?: number): Promise<TelemetryData> {
        const memoryUsage = this.getMemoryUsage();
        const cpuTemp = serverCpuTemp ?? await this.estimateCPUTemp();
        const npuLoad = this.estimateNPULoad();
        const pcieLaneUsage = this.estimatePCIeUsage();

        return {
            cpuTemp,
            npuLoad,
            pcieLaneUsage,
            memoryUsage
        };
    }

    /**
     * Get real memory usage from performance.memory (Chrome/Chromium) or estimate.
     */
    private getMemoryUsage(): number {
        // Chrome/Chromium expose performance.memory
        const perf = performance as any;
        if (perf.memory) {
            const used = perf.memory.usedJSHeapSize;
            const total = perf.memory.jsHeapSizeLimit;
            if (total > 0) {
                // Return as percentage of JS heap limit
                return (used / total) * 100;
            }
        }

        // Fallback: use navigator.deviceMemory if available
        const nav = navigator as any;
        if (nav.deviceMemory) {
            // deviceMemory gives total RAM in GB (approximate)
            // We estimate usage based on heap via performance entries
            const entries = performance.getEntriesByType('resource');
            const totalTransferred = entries.reduce((sum, entry: any) => sum + (entry.transferSize || 0), 0);
            const estimatedUsageMB = totalTransferred / (1024 * 1024);
            const totalMB = nav.deviceMemory * 1024;
            return Math.min(95, (estimatedUsageMB / totalMB) * 100 + 15); // Base usage + resource overhead
        }

        // Final fallback: estimate from performance resource count
        const resourceCount = performance.getEntriesByType('resource').length;
        return Math.min(80, 20 + resourceCount * 0.5);
    }

    /**
     * Estimate CPU temperature.
     * Real temp comes from the server endpoint on Pi hardware.
     * In browser-only mode, we estimate from recent performance entries.
     */
    private async estimateCPUTemp(): Promise<number> {
        // Try to get from server (Pi hardware)
        try {
            const res = await fetch('/api/system/status');
            if (res.ok) {
                const data = await res.json();
                if (data.cpu_temp && data.cpu_temp > 0) {
                    return data.cpu_temp;
                }
            }
        } catch (e) {
            // Server not available
        }

        // Estimate from browser task density using non-blocking long task observer
        const longTasks = performance.getEntriesByType('longtask') as any[];
        const recentTasks = longTasks.filter(
            t => t.startTime > performance.now() - 10000
        );
        // More long tasks = higher load = warmer CPU
        const loadFactor = Math.min(1, recentTasks.length / 10);
        return 40 + loadFactor * 30; // Range: 40-70°C estimate
    }

    /**
     * Estimate NPU load based on active Web Workers and audio worklets.
     * Real NPU metrics require the server endpoint (Hailo SDK).
     */
    private estimateNPULoad(): number {
        // Check if AudioWorklet is active (proxy for DSP load)
        const audioContexts = (window as any).__phantomAudioContexts || 0;
        const baseLoad = audioContexts > 0 ? 25 : 5;

        // Add estimation from long tasks (if available)
        const longTasks = performance.getEntriesByType('longtask') as any[];
        const recentLongTasks = longTasks.filter(
            t => t.startTime > performance.now() - 10000
        ).length;

        return Math.min(100, baseLoad + recentLongTasks * 8);
    }

    /**
     * Estimate PCIe lane usage from transfer rates of recent network requests.
     */
    private estimatePCIeUsage(): number {
        const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const recentEntries = entries.filter(
            e => e.startTime > performance.now() - 5000
        );

        if (recentEntries.length === 0) return 0.1;

        const totalBytes = recentEntries.reduce((sum, e) => sum + (e.transferSize || 0), 0);
        const totalTime = recentEntries.reduce((sum, e) => sum + (e.duration || 1), 0);

        // Convert to GB/s estimate
        const bytesPerMs = totalBytes / Math.max(1, totalTime);
        const gbPerS = (bytesPerMs * 1000) / (1024 * 1024 * 1024);

        return Math.min(32, Math.max(0.1, gbPerS));
    }
}

export const telemetryService = new TelemetryService();
