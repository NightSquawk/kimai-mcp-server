import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KimaiClient } from "../services/kimai-client.js";
import { CollectionSchema, EntityIdSchema, TimesheetCollectionSchema } from "../schemas/resources.js";
import { registerCollectionReadTool, registerEntityReadTool } from "./read-tools.js";

export function registerTimesheetTools(server: McpServer, client: KimaiClient): void {
  registerCollectionReadTool(server, client, {
    name: "kimai_list_timesheets",
    title: "List Kimai Timesheets",
    description: "List Kimai timesheet entries from /api/timesheets with optional user, customer, project, activity, date, tag, exported, and active filters. This tool is read-only.",
    inputSchema: TimesheetCollectionSchema.shape,
    path: () => "/api/timesheets",
    query: (params) => ({
      user: params.user,
      customer: params.customer,
      project: params.project,
      activity: params.activity,
      begin: params.begin,
      end: params.end,
      exported: params.exported,
      active: params.active,
      tags: Array.isArray(params.tags) ? params.tags.join(",") : undefined
    }),
    preferredFields: ["id", "user", "project", "activity", "begin", "end", "duration", "rate", "description"],
    heading: "Kimai Timesheets"
  });

  registerEntityReadTool(server, client, {
    name: "kimai_get_timesheet",
    title: "Get Kimai Timesheet",
    description: "Read one Kimai timesheet entry from /api/timesheets/<id>. This tool is read-only.",
    inputSchema: EntityIdSchema.shape,
    path: (params) => `/api/timesheets/${encodeURIComponent(String(params.id))}`,
    preferredFields: ["id", "user", "project", "activity", "begin", "end", "duration", "rate", "description"],
    heading: "Kimai Timesheet"
  });

  registerCollectionReadTool(server, client, {
    name: "kimai_list_active_timesheets",
    title: "List Active Kimai Timesheets",
    description: "List currently running Kimai timesheet entries from /api/timesheets/active. This tool is read-only.",
    inputSchema: CollectionSchema.shape,
    path: () => "/api/timesheets/active",
    preferredFields: ["id", "user", "project", "activity", "begin", "duration", "description"],
    heading: "Active Kimai Timesheets"
  });

  registerCollectionReadTool(server, client, {
    name: "kimai_list_recent_timesheets",
    title: "List Recent Kimai Timesheets",
    description: "List recent Kimai timesheet entries from /api/timesheets/recent. This tool is read-only.",
    inputSchema: CollectionSchema.shape,
    path: () => "/api/timesheets/recent",
    preferredFields: ["id", "user", "project", "activity", "begin", "end", "duration", "description"],
    heading: "Recent Kimai Timesheets"
  });
}
