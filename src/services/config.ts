import "dotenv/config";
import { DEFAULT_TIMEOUT_MS, ENV } from "../constants.js";
import type { KimaiConfig } from "../types.js";

export function loadConfig(): KimaiConfig {
  const baseUrl = process.env[ENV.baseUrl]?.trim();
  const apiToken = process.env[ENV.apiToken]?.trim();
  const timeoutRaw = process.env[ENV.timeoutMs]?.trim();

  if (!baseUrl) {
    throw new Error(`${ENV.baseUrl} is required, for example https://example.kimai.cloud`);
  }

  if (!apiToken) {
    throw new Error(`${ENV.apiToken} is required. Generate an API token in your Kimai user profile.`);
  }

  const timeoutMs = timeoutRaw ? Number.parseInt(timeoutRaw, 10) : DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000) {
    throw new Error(`${ENV.timeoutMs} must be an integer of at least 1000 milliseconds.`);
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiToken,
    timeoutMs
  };
}
