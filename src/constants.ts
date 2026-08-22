export const SERVER_NAME = "kimai-mcp-server";
export const SERVER_VERSION = "0.2.0";

export const ENV = {
  baseUrl: "KIMAI_BASE_URL",
  apiToken: "KIMAI_API_TOKEN",
  timeoutMs: "KIMAI_TIMEOUT_MS",
  allowDelete: "KIMAI_ALLOW_DELETE"
} as const;

export const DEFAULT_TIMEOUT_MS = 30_000;
export const RESPONSE_CHARACTER_LIMIT = 25_000;

/**
 * Refusal returned by every delete tool when the environment gate is off.
 *
 * Deletes are the only operations behind an env gate. Reads always run, and
 * non-destructive writes (create/update/stop/restart/duplicate) keep the
 * per-call authorization fields they have had since 0.1.0, so enabling this
 * variable is the single opt-in an operator makes for irreversible calls.
 * The gate is checked BEFORE the per-call authorization fields, matching the
 * layering used by the other NightSquawk MCP servers.
 */
export const DELETE_GATE_MESSAGE =
  `Delete refused: ${ENV.allowDelete} is not enabled on this MCP server. ` +
  `Set ${ENV.allowDelete}=true in the server environment to allow irreversible Kimai deletes. ` +
  "This gate is checked before the per-call authorization fields, so no request was sent to Kimai.";
