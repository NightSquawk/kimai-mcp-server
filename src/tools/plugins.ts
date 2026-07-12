import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KimaiClient } from "../services/kimai-client.js";
import { CollectionSchema, EntityIdSchema } from "../schemas/resources.js";
import { registerCollectionReadTool, registerEntityReadTool } from "./read-tools.js";

export function registerPluginTools(server: McpServer, client: KimaiClient): void {
  registerCollectionReadTool(server, client, {
    name: "kimai_list_expenses",
    title: "List Kimai Expenses",
    description: "List expenses from /api/expenses when the Kimai expenses feature/plugin is available. This tool is read-only.",
    inputSchema: CollectionSchema.shape,
    path: () => "/api/expenses",
    preferredFields: ["id", "user", "project", "activity", "date", "amount", "description"],
    heading: "Kimai Expenses"
  });

  registerEntityReadTool(server, client, {
    name: "kimai_get_expense",
    title: "Get Kimai Expense",
    description: "Read one expense from /api/expenses/<id> when the Kimai expenses feature/plugin is available. This tool is read-only.",
    inputSchema: EntityIdSchema.shape,
    path: (params) => `/api/expenses/${encodeURIComponent(String(params.id))}`,
    preferredFields: ["id", "user", "project", "activity", "date", "amount", "description"],
    heading: "Kimai Expense"
  });

  registerCollectionReadTool(server, client, {
    name: "kimai_list_tasks",
    title: "List Kimai Tasks",
    description: "List tasks from /api/tasks when the Kimai tasks feature/plugin is available. This tool is read-only.",
    inputSchema: CollectionSchema.shape,
    path: () => "/api/tasks",
    preferredFields: ["id", "title", "user", "project", "activity", "status", "priority"],
    heading: "Kimai Tasks"
  });

  registerEntityReadTool(server, client, {
    name: "kimai_get_task",
    title: "Get Kimai Task",
    description: "Read one task from /api/tasks/<id> when the Kimai tasks feature/plugin is available. This tool is read-only.",
    inputSchema: EntityIdSchema.shape,
    path: (params) => `/api/tasks/${encodeURIComponent(String(params.id))}`,
    preferredFields: ["id", "title", "user", "project", "activity", "status", "priority"],
    heading: "Kimai Task"
  });
}
