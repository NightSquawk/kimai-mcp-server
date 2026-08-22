export const SERVER_NAME = "kimai-mcp-server";
export const SERVER_VERSION = "0.3.0";

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
/**
 * Shared refusal text for a delete attempted while the env gate is off.
 *
 * It states only what is true on BOTH paths that emit it. The curated delete
 * tools check this gate before the per-call authorization fields;
 * kimai_call_endpoint checks it after them, deliberately, so that the blocker
 * a human has to clear is the message a caller ends on (the reasoning is
 * written out in tools/endpoint-catalog/call-endpoint.ts). Only the ordering
 * differs. Both check the gate before opening a socket, so the guarantee that
 * actually matters to a caller -- that nothing reached Kimai -- holds either
 * way and is the one this message makes.
 */
export const DELETE_GATE_MESSAGE =
  `Delete refused: ${ENV.allowDelete} is not enabled on this MCP server. ` +
  `Set ${ENV.allowDelete}=true in the server environment to allow irreversible Kimai deletes. ` +
  "The gate is checked before any network call, so no request was sent to Kimai.";
