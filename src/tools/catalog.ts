import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KimaiClient } from "../services/kimai-client.js";
import {
  ActivityCollectionSchema,
  CustomerCollectionSchema,
  EntityIdSchema,
  ProjectCollectionSchema,
  TagCollectionSchema
} from "../schemas/resources.js";
import { registerCollectionReadTool, registerEntityReadTool } from "./read-tools.js";
import { flag, list, visibility } from "./query.js";

const CUSTOMER_FIELDS = ["id", "name", "number", "company", "visible", "billable", "country", "language", "currency"];
const PROJECT_FIELDS = ["id", "name", "customer", "visible", "billable", "orderNumber", "start", "end", "budget"];
const ACTIVITY_FIELDS = ["id", "name", "project", "visible", "billable", "budget", "timeBudget"];

export function registerCatalogTools(server: McpServer, client: KimaiClient): void {
  registerCollectionReadTool(server, client, {
    name: "kimai_list_customers",
    title: "List Kimai Customers",
    description: "List customers visible to the Kimai API token from /api/customers. This tool is read-only.",
    inputSchema: CustomerCollectionSchema.shape,
    path: () => "/api/customers",
    query: (params) => ({
      term: params.term,
      orderBy: params.order_by,
      order: params.order,
      visible: visibility(params.visible),
      full: flag(params.full)
    }),
    preferredFields: CUSTOMER_FIELDS,
    heading: "Kimai Customers"
  });

  registerEntityReadTool(server, client, {
    name: "kimai_get_customer",
    title: "Get Kimai Customer",
    description: "Read one Kimai customer from /api/customers/<id>. This tool is read-only.",
    inputSchema: EntityIdSchema.shape,
    path: (params) => `/api/customers/${encodeURIComponent(String(params.id))}`,
    preferredFields: [...CUSTOMER_FIELDS, "invoiceEmail", "vatId", "timezone"],
    heading: "Kimai Customer"
  });

  registerCollectionReadTool(server, client, {
    name: "kimai_list_projects",
    title: "List Kimai Projects",
    description:
      "List projects visible to the Kimai API token from /api/projects, optionally filtered by customer, date range, or visibility. This tool is read-only.",
    inputSchema: ProjectCollectionSchema.shape,
    path: () => "/api/projects",
    query: (params) => ({
      term: params.term,
      orderBy: params.order_by,
      order: params.order,
      visible: visibility(params.visible),
      customer: params.customer,
      customers: list(params.customers),
      start: params.start,
      end: params.end,
      ignoreDates: flag(params.ignore_dates),
      globalActivities: flag(params.global_activities)
    }),
    preferredFields: PROJECT_FIELDS,
    heading: "Kimai Projects"
  });

  registerEntityReadTool(server, client, {
    name: "kimai_get_project",
    title: "Get Kimai Project",
    description: "Read one Kimai project from /api/projects/<id>. This tool is read-only.",
    inputSchema: EntityIdSchema.shape,
    path: (params) => `/api/projects/${encodeURIComponent(String(params.id))}`,
    preferredFields: PROJECT_FIELDS,
    heading: "Kimai Project"
  });

  registerCollectionReadTool(server, client, {
    name: "kimai_list_activities",
    title: "List Kimai Activities",
    description:
      "List activities visible to the Kimai API token from /api/activities, optionally filtered by project or globals-only. This tool is read-only.",
    inputSchema: ActivityCollectionSchema.shape,
    path: () => "/api/activities",
    query: (params) => ({
      term: params.term,
      orderBy: params.order_by,
      order: params.order,
      visible: visibility(params.visible),
      project: params.project,
      projects: list(params.projects),
      globals: flag(params.globals)
    }),
    preferredFields: ACTIVITY_FIELDS,
    heading: "Kimai Activities"
  });

  registerEntityReadTool(server, client, {
    name: "kimai_get_activity",
    title: "Get Kimai Activity",
    description: "Read one Kimai activity from /api/activities/<id>. This tool is read-only.",
    inputSchema: EntityIdSchema.shape,
    path: (params) => `/api/activities/${encodeURIComponent(String(params.id))}`,
    preferredFields: ACTIVITY_FIELDS,
    heading: "Kimai Activity"
  });

  /**
   * Kimai splits tags across two endpoints and neither one alone behaves like
   * "list the tags". /api/tags/find returns full tag objects but its handler
   * only queries when a name is supplied, so calling it bare returns []. This
   * tool therefore falls back to /api/tags, which returns every tag name, when
   * no search term is given.
   */
  registerCollectionReadTool(server, client, {
    name: "kimai_list_tags",
    title: "List Kimai Tags",
    description:
      "List Kimai tags. With a name, searches /api/tags/find and returns full tag objects; without one, lists every tag name from /api/tags. This tool is read-only.",
    inputSchema: TagCollectionSchema.shape,
    path: (params) => (params.name ? "/api/tags/find" : "/api/tags"),
    query: (params) => (params.name ? { name: params.name } : {}),
    preferredFields: ["id", "name", "color", "visible"],
    heading: "Kimai Tags",
    paginated: false
  });
}
