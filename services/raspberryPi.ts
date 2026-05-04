import { execFile } from "child_process";
import { access, readFile } from "fs/promises";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type SystemStatus = {
  ollama: boolean;
  hailo: boolean;
  minima: boolean;
  radio: boolean;
  lmms: boolean;
  mixxx: boolean;
  production_engine: string;
  mixing_engine: string;
  sample_formats: string[];
  kernel: string;
  cpu_temp: number | null;
  memory_used_gb: number | null;
};

export async function commandExists(command: string) {
  try {
    await execFileAsync(process.platform === "win32" ? "where" : "which", [command]);
    return true;
  } catch {
    return false;
  }
}

export async function hasLocalFmBinary(appRoot: string) {
  try {
    await access(path.join(appRoot, "pi_fm_rds"));
    return true;
  } catch {
    return commandExists("pi_fm_rds");
  }
}

export async function readPiCpuTemperature() {
  try {
    const raw = await readFile("/sys/class/thermal/thermal_zone0/temp", "utf8");
    const temp = Number.parseInt(raw, 10) / 1000;
    return Number.isFinite(temp) ? temp : null;
  } catch {
    return null;
  }
}

export async function readKernelRelease() {
  try {
    return (await readFile("/proc/sys/kernel/osrelease", "utf8")).trim();
  } catch {
    return "UNKNOWN";
  }
}

export async function readMemoryUsageGb() {
  try {
    const raw = await readFile("/proc/meminfo", "utf8");
    const values = new Map<string, number>();
    for (const line of raw.split("\n")) {
      const [key, value = ""] = line.split(":");
      const match = value.match(/\d+/);
      if (key && match) values.set(key, Number.parseInt(match[0], 10));
    }
    const total = values.get("MemTotal");
    const available = values.get("MemAvailable");
    if (!total || !available) return null;
    return Math.round(((total - available) / 1024 / 1024) * 10) / 10;
  } catch {
    return null;
  }
}

export async function isHttpOk(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(1500) }).catch(() => null);
  return !!response?.ok;
}

export async function probeSystemStatus(config: {
  appRoot: string;
  ollamaTagsUrl: string;
  minimaStatusUrl: string;
}): Promise<SystemStatus> {
  const kernel = await readKernelRelease();
  const status: SystemStatus = {
    ollama: false,
    hailo: false,
    minima: false,
    radio: false,
    lmms: false,
    mixxx: false,
    production_engine: "LMMS",
    mixing_engine: "Mixxx",
    sample_formats: ["AKAI_MPC_PROGRAM", "SERATO_SLAB_MANIFEST"],
    kernel,
    cpu_temp: null,
    memory_used_gb: null
  };

  status.ollama = await isHttpOk(config.ollamaTagsUrl);
  status.minima = await isHttpOk(config.minimaStatusUrl);

  try {
    const { stdout } = await execFileAsync("hailortcli", ["scan"]);
    status.hailo = stdout.includes("Device");
  } catch {
    status.hailo = false;
  }

  status.cpu_temp = await readPiCpuTemperature();
  status.memory_used_gb = await readMemoryUsageGb();
  status.radio = await hasLocalFmBinary(config.appRoot);
  status.lmms = await commandExists("lmms");
  status.mixxx = await commandExists("mixxx");
  status.production_engine = status.lmms ? "LMMS" : "LMMS unavailable";
  status.mixing_engine = status.mixxx ? "Mixxx" : "Mixxx unavailable";

  return status;
}
