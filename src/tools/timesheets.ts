import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KimaiClient } from "../services/kimai-client.js";
import {
  EntityIdSchema,
  RecentTimesheetSchema,
  TimesheetCollectionSchema,
  UnpaginatedCollectionSchema
} from "../schemas/resources.js";
import { registerCollectionReadTool, registerEntityReadTool } from "./read-tools.js";
import { flag, list } from "./query.js";

const TIMESHEET_FIELDS = [
  "id",
  "user",
  "project",
  "activity",
  "begin",
  "end",
  "duration",
  "rate",
  "billable",
  "exported",
  "description"
];

export function registerTimesheetTools(server: McpServer, client: KimaiClient): void {
  registerCollectionReadTool(server, client, {
    name: "kimai_list_timesheets",
    title: "List Kimai Timesheets",
    description:
      'List Kimai timesheet entries from /api/timesheets. Filters: user (pass "all" for every user, otherwise only the token owner\'s entries are returned), users, customer(s), project(s), activity(s), begin, end, modified_after, exported, active, billable, tags, term, and sorting. Kimai returns HTTP 400 for a tag name that does not exist, so verify tags with kimai_list_tags. This tool is read-only.',
    inputSchema: TimesheetCollectionSchema.shape,
    path: () => "/api/timesheets",
    query: (params) => ({
      user: params.user,
      users: list(params.users),
      customer: params.customer,
      customers: list(params.customers),
      project: params.project,
      projects: list(params.projects),
      activity: params.activity,
      activities: list(params.activities),
      begin: params.begin,
      end: params.end,
      modified_after: params.modified_after,
      exported: flag(params.exported),
      active: flag(params.active),
      billable: flag(params.billable),
      full: flag(params.full),
      term: params.term,
      orderBy: params.order_by,
      order: params.order,
      // Must stay an array. Measured on a 500-row window against Kimai 2.65.0:
      // tags=<existing> returned all 500 rows (filter silently dropped) while
      // tags[]=<existing> returned 0. See query.ts.
      tags: list(params.tags)
    }),
    preferredFields: TIMESHEET_FIELDS,
    heading: "Kimai Timesheets"
  });

  registerEntityReadTool(server, client, {
    name: "kimai_get_timesheet",
    title: "Get Kimai Timesheet",
    description: "Read one Kimai timesheet entry from /api/timesheets/<id>. This tool is read-only.",
    inputSchema: EntityIdSchema.shape,
    path: (params) => `/api/timesheets/${encodeURIComponent(String(params.id))}`,
    preferredFields: TIMESHEET_FIELDS,
    heading: "Kimai Timesheet"
  });

  registerCollectionReadTool(server, client, {
    name: "kimai_list_active_timesheets",
    title: "List Active Kimai Timesheets",
    description:
      "List currently running Kimai timesheet entries from /api/timesheets/active. This endpoint takes no filters and returns the running entries for the token owner. This tool is read-only.",
    inputSchema: UnpaginatedCollectionSchema.shape,
    path: () => "/api/timesheets/active",
    preferredFields: ["id", "user", "project", "activity", "begin", "duration", "description"],
    heading: "Active Kimai Timesheets",
    paginated: false
  });

  registerCollectionReadTool(server, client, {
    name: "kimai_list_recent_timesheets",
    title: "List Recent Kimai Timesheets",
    description:
      "List recent Kimai timesheet entries from /api/timesheets/recent, one per unique customer/project/activity set. Accepts begin and size only; this endpoint does not paginate. This tool is read-only.",
    inputSchema: RecentTimesheetSchema.shape,
    path: () => "/api/timesheets/recent",
    query: (params) => ({ begin: params.begin, size: params.size }),
    preferredFields: TIMESHEET_FIELDS,
    heading: "Recent Kimai Timesheets",
    paginated: false
  });
}
