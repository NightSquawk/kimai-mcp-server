import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KimaiClient } from "../services/kimai-client.js";
import { registerBusinessTools } from "./business.js";
import { registerCatalogTools } from "./catalog.js";
import { registerPluginTools } from "./plugins.js";
import { registerServerTools } from "./server.js";
import { registerTimesheetMutationTools } from "./timesheet-mutations.js";
import { registerTimesheetTools } from "./timesheets.js";
import { registerUserTools } from "./users.js";

export function registerTools(server: McpServer, client: KimaiClient): void {
  registerServerTools(server, client);
  registerUserTools(server, client);
  registerCatalogTools(server, client);
  registerTimesheetTools(server, client);
  registerTimesheetMutationTools(server, client);
  registerBusinessTools(server, client);
  registerPluginTools(server, client);
}
