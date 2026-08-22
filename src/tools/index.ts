import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KimaiClient } from "../services/kimai-client.js";
import { registerBusinessTools } from "./business.js";
import { registerCatalogTools } from "./catalog.js";
import { registerEntityMutationTools } from "./entity-mutations.js";
import { registerPluginTools } from "./plugins.js";
import { registerServerTools } from "./server.js";
import { registerSubresourceTools } from "./subresources.js";
import { registerTimesheetMutationTools } from "./timesheet-mutations.js";
import { registerTimesheetTools } from "./timesheets.js";
import { registerUserTools } from "./users.js";

/**
 * Registration order is read tools first, then writes, then deletes within
 * each module. It has no runtime effect, but it keeps the tool list a client
 * displays grouped the way an operator thinks about the API.
 */
export function registerTools(server: McpServer, client: KimaiClient): void {
  registerServerTools(server, client);
  registerUserTools(server, client);
  registerCatalogTools(server, client);
  registerTimesheetTools(server, client);
  registerTimesheetMutationTools(server, client);
  registerBusinessTools(server, client);
  registerPluginTools(server, client);
  registerEntityMutationTools(server, client);
  registerSubresourceTools(server, client);
}
