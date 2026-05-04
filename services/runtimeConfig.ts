export type RuntimeConfig = {
  host: string;
  port: number;
  appUrl: string;
  ollamaTagsUrl: string;
  minimaStatusUrl: string;
  jsonLimit: string;
  rateLimits: {
    ghostSummonPerMinute: number;
    systemStatusPerMinute: number;
    productionStaticPerMinute: number;
  };
};

function parseInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function normalizeBaseUrl(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString().replace(/\/$/, "");
    }
  } catch {
    // Fall through to the safe default.
  }

  return fallback;
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const port = parseInteger(env.PORT, 3000, 1, 65535);
  const appUrl = normalizeBaseUrl(env.APP_URL, `http://localhost:${port}`);
  const ollamaBaseUrl = normalizeBaseUrl(env.OLLAMA_BASE_URL, "http://localhost:11434");
  const minimaBaseUrl = normalizeBaseUrl(env.MINIMA_BASE_URL, "http://localhost:9001");

  return {
    host: env.HOST?.trim() || "0.0.0.0",
    port,
    appUrl,
    ollamaTagsUrl: `${ollamaBaseUrl}/api/tags`,
    minimaStatusUrl: `${minimaBaseUrl}/status`,
    jsonLimit: env.JSON_BODY_LIMIT || "64kb",
    rateLimits: {
      ghostSummonPerMinute: parseInteger(env.GHOST_SUMMON_RATE_LIMIT, 10, 1, 120),
      systemStatusPerMinute: parseInteger(env.SYSTEM_STATUS_RATE_LIMIT, 30, 1, 300),
      productionStaticPerMinute: parseInteger(env.STATIC_RATE_LIMIT, 120, 1, 1000)
    }
  };
}
