#!/usr/bin/env node
/**
 * Entry point for kimai-mcp-server.
 *
 * Server construction and the stdio handoff come from @nightsquawktech/mcp-core
 * so this server boots the same way as the other NightSquawk MCP servers. The
 * catalog primitives in mcp-core are deliberately not used here: this server
 * exposes named, curated tools rather than the three generic
 * list/describe/call_endpoint tools, because the Kimai surface is small enough
 * to model directly and the timesheet tools carry write gates and response
 * shaping that a generic call_endpoint cannot express.
 *
 * stdout is reserved for the MCP protocol, so nothing here may console.log.
 * Startup diagnostics go to stderr through the runStdioServer banner.
 */
import { createMcpServer, runStdioServer } from "@nightsquawktech/mcp-core";
import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { KimaiClient } from "./services/kimai-client.js";
import { loadConfig } from "./services/config.js";
import { registerTools } from "./tools/index.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new KimaiClient(config);
  const server = createMcpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  registerTools(server, client);

  const deleteState = config.allowDelete ? "deletes ENABLED" : "deletes disabled";
  await runStdioServer(server, {
    banner: `${SERVER_NAME} ${SERVER_VERSION} running on stdio (${deleteState})`
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
