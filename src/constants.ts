export const SERVER_NAME = "kimai-mcp-server";
export const SERVER_VERSION = "0.1.0";

export const ENV = {
  baseUrl: "KIMAI_BASE_URL",
  apiToken: "KIMAI_API_TOKEN",
  timeoutMs: "KIMAI_TIMEOUT_MS"
} as const;

export const DEFAULT_TIMEOUT_MS = 30_000;
export const RESPONSE_CHARACTER_LIMIT = 25_000;
