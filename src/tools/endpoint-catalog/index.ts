import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KimaiClient } from "../../services/kimai-client.js";
import { registerCallEndpointTool } from "./call-endpoint.js";
import { registerDescribeEndpointTool } from "./describe-endpoint.js";
import { registerListEndpointsTool } from "./list-endpoints.js";

/**
 * The three generic tools that expose the whole Kimai API through the
 * generated endpoint catalog: discover, describe, call.
 *
 * Note the two unrelated senses of "catalog" in this codebase. `tools/catalog.ts`
 * is the BUSINESS catalog: curated read tools over Kimai's customers, projects,
 * activities and tags. This directory is the ENDPOINT catalog: the generated
 * index of all 91 API operations. They share a word and nothing else, which is
 * why this directory is `endpoint-catalog/` rather than `catalog/`.
 *
 * Registered after the curated tools so a client listing tools in registration
 * order sees the specific, well-guarded tools before the general escape hatch.
 */
export function registerEndpointCatalogTools(server: McpServer, client: KimaiClient): void {
  registerListEndpointsTool(server);
  registerDescribeEndpointTool(server);
  registerCallEndpointTool(server, client);
}
