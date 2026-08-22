import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KimaiClient } from "../services/kimai-client.js";
import { registerCatalogTools } from "./catalog.js";
import { registerEndpointCatalogTools } from "./endpoint-catalog/index.js";
import { registerTimesheetMutationTools } from "./timesheet-mutations.js";
import { registerTimesheetTools } from "./timesheets.js";
import { registerUserTools } from "./users.js";

/**
 * Registration order is read tools first, then writes, then deletes within
 * each module. It has no runtime effect, but it keeps the tool list a client
 * displays grouped the way an operator thinks about the API.
 */
export function registerTools(server: McpServer, client: KimaiClient): void {
  registerUserTools(server, client);
  registerCatalogTools(server, client);
  registerTimesheetTools(server, client);
  registerTimesheetMutationTools(server, client);
  registerEndpointCatalogTools(server, client);
}
