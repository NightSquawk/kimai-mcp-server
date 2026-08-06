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

export function registerCatalogTools(server: McpServer, client: KimaiClient): void {
  registerCollectionReadTool(server, client, {
    name: "kimai_list_customers",
    title: "List Kimai Customers",
    description: "List customers visible to the Kimai API token from /api/customers. This tool is read-only.",
    inputSchema: CustomerCollectionSchema.shape,
    path: () => "/api/customers",
    query: (params) => commonQuery(params),
    preferredFields: ["id", "name", "number", "company", "visible", "country", "language", "currency"],
    heading: "Kimai Customers"
  });

  registerEntityReadTool(server, client, {
    name: "kimai_get_customer",
    title: "Get Kimai Customer",
    description: "Read one Kimai customer from /api/customers/<id>. This tool is read-only.",
    inputSchema: EntityIdSchema.shape,
    path: (params) => `/api/customers/${encodeURIComponent(String(params.id))}`,
    preferredFields: ["id", "name", "number", "company", "visible", "country", "language", "currency", "invoiceEmail"],
    heading: "Kimai Customer"
  });

  registerCollectionReadTool(server, client, {
    name: "kimai_list_projects",
    title: "List Kimai Projects",
    description: "List projects visible to the Kimai API token from /api/projects, optionally filtered by customer. This tool is read-only.",
    inputSchema: ProjectCollectionSchema.shape,
    path: () => "/api/projects",
    query: (params) => commonQuery(params),
    preferredFields: ["id", "name", "customer", "visible", "orderNumber", "budget"],
    heading: "Kimai Projects"
  });

  registerEntityReadTool(server, client, {
    name: "kimai_get_project",
    title: "Get Kimai Project",
    description: "Read one Kimai project from /api/projects/<id>. This tool is read-only.",
    inputSchema: EntityIdSchema.shape,
    path: (params) => `/api/projects/${encodeURIComponent(String(params.id))}`,
    preferredFields: ["id", "name", "customer", "visible", "orderNumber", "budget"],
    heading: "Kimai Project"
  });

  registerCollectionReadTool(server, client, {
    name: "kimai_list_activities",
    title: "List Kimai Activities",
    description: "List activities visible to the Kimai API token from /api/activities, optionally filtered by project. This tool is read-only.",
    inputSchema: ActivityCollectionSchema.shape,
    path: () => "/api/activities",
    query: (params) => commonQuery(params),
    preferredFields: ["id", "name", "project", "visible", "budget", "timeBudget"],
    heading: "Kimai Activities"
  });

  registerEntityReadTool(server, client, {
    name: "kimai_get_activity",
    title: "Get Kimai Activity",
    description: "Read one Kimai activity from /api/activities/<id>. This tool is read-only.",
    inputSchema: EntityIdSchema.shape,
    path: (params) => `/api/activities/${encodeURIComponent(String(params.id))}`,
    preferredFields: ["id", "name", "project", "visible", "budget", "timeBudget"],
    heading: "Kimai Activity"
  });

  registerCollectionReadTool(server, client, {
    name: "kimai_list_tags",
    title: "List Kimai Tags",
    description: "List Kimai tags from /api/tags/find. This tool is read-only.",
    inputSchema: TagCollectionSchema.shape,
    path: () => "/api/tags/find",
    query: (params) => ({ name: params.name }),
    preferredFields: ["id", "name", "color"],
    heading: "Kimai Tags"
  });
}

// Kimai expects the visibility filter as an integer; the string form returns HTTP 400.
const VISIBILITY_QUERY: Record<string, number> = {
  visible: 1,
  hidden: 2,
  all: 3
};

function commonQuery(params: Record<string, unknown>): Record<string, unknown> {
  return {
    term: params.term,
    orderBy: params.order_by,
    order: params.order,
    visible: typeof params.visible === "string" ? VISIBILITY_QUERY[params.visible] : params.visible,
    customer: params.customer,
    project: params.project
  };
}
