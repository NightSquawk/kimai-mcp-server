import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KimaiClient } from "../services/kimai-client.js";
import { AbsenceCollectionSchema, CollectionSchema, EntityIdSchema } from "../schemas/resources.js";
import { registerCollectionReadTool, registerEntityReadTool } from "./read-tools.js";

/**
 * Tools for Kimai's optional bundles.
 *
 * These endpoints exist only when the matching plugin is installed, so each
 * tool returns a normal Kimai 404 rather than failing at startup on an
 * instance without it. Nothing here is gated on /api/plugins: probing at
 * registration time would make the tool list depend on network state.
 */
export function registerPluginTools(server: McpServer, client: KimaiClient): void {
  registerCollectionReadTool(server, client, {
    name: "kimai_list_expenses",
    title: "List Kimai Expenses",
    description: "List expenses from /api/expenses when the Kimai expenses plugin is installed. This tool is read-only.",
    inputSchema: CollectionSchema.shape,
    path: () => "/api/expenses",
    preferredFields: ["id", "user", "project", "activity", "date", "amount", "description"],
    heading: "Kimai Expenses"
  });

  registerEntityReadTool(server, client, {
    name: "kimai_get_expense",
    title: "Get Kimai Expense",
    description: "Read one expense from /api/expenses/<id> when the Kimai expenses plugin is installed. This tool is read-only.",
    inputSchema: EntityIdSchema.shape,
    path: (params) => `/api/expenses/${encodeURIComponent(String(params.id))}`,
    preferredFields: ["id", "user", "project", "activity", "date", "amount", "description"],
    heading: "Kimai Expense"
  });

  registerCollectionReadTool(server, client, {
    name: "kimai_list_tasks",
    title: "List Kimai Tasks",
    description: "List tasks from /api/tasks when the Kimai task management plugin is installed. This tool is read-only.",
    inputSchema: CollectionSchema.shape,
    path: () => "/api/tasks",
    preferredFields: ["id", "title", "user", "project", "activity", "status", "priority"],
    heading: "Kimai Tasks"
  });

  registerEntityReadTool(server, client, {
    name: "kimai_get_task",
    title: "Get Kimai Task",
    description: "Read one task from /api/tasks/<id> when the Kimai task management plugin is installed. This tool is read-only.",
    inputSchema: EntityIdSchema.shape,
    path: (params) => `/api/tasks/${encodeURIComponent(String(params.id))}`,
    preferredFields: ["id", "title", "user", "project", "activity", "status", "priority"],
    heading: "Kimai Task"
  });

  registerCollectionReadTool(server, client, {
    name: "kimai_list_absences",
    title: "List Kimai Absences",
    description:
      "List absences (holiday, sickness, time off) from /api/absences when the Kimai work contract plugin is installed. Use this to explain gaps in a timesheet report. This tool is read-only.",
    inputSchema: AbsenceCollectionSchema.shape,
    path: () => "/api/absences",
    query: (params) => ({ user: params.user, begin: params.begin, end: params.end }),
    preferredFields: ["id", "user", "date", "end", "type", "status", "duration", "comment"],
    heading: "Kimai Absences",
    paginated: false
  });

  registerCollectionReadTool(server, client, {
    name: "kimai_list_public_holidays",
    title: "List Kimai Public Holidays",
    description:
      "List configured public holidays from /api/public-holidays when the Kimai work contract plugin is installed. This tool is read-only.",
    inputSchema: AbsenceCollectionSchema.shape,
    path: () => "/api/public-holidays",
    query: (params) => ({ begin: params.begin, end: params.end }),
    preferredFields: ["id", "name", "date", "group", "duration"],
    heading: "Kimai Public Holidays",
    paginated: false
  });
}
