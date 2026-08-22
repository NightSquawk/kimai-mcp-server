import "dotenv/config";
import { DEFAULT_TIMEOUT_MS, ENV } from "../constants.js";
import type { KimaiConfig } from "../types.js";

/** Values accepted as "on" for boolean environment gates. */
const TRUTHY = new Set(["1", "true", "yes", "on"]);
const FALSY = new Set(["", "0", "false", "no", "off"]);

export function loadConfig(): KimaiConfig {
  const baseUrl = process.env[ENV.baseUrl]?.trim();
  const apiToken = process.env[ENV.apiToken]?.trim();
  const timeoutRaw = process.env[ENV.timeoutMs]?.trim();
  const allowDeleteRaw = process.env[ENV.allowDelete]?.trim().toLowerCase() ?? "";

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

  // Fail loudly on a typo rather than silently defaulting to "deletes off": an
  // operator who wrote KIMAI_ALLOW_DELETE=enabled meant to turn it on, and a
  // silent false would look like a broken tool instead of a config mistake.
  if (!TRUTHY.has(allowDeleteRaw) && !FALSY.has(allowDeleteRaw)) {
    throw new Error(
      `${ENV.allowDelete} must be one of true/false/1/0/yes/no/on/off (got "${allowDeleteRaw}").`
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiToken,
    timeoutMs,
    allowDelete: TRUTHY.has(allowDeleteRaw)
  };
}
