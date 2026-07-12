import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KimaiClient } from "../services/kimai-client.js";
import { CollectionSchema, EntityIdSchema, SearchableCollectionSchema } from "../schemas/resources.js";
import { registerCollectionReadTool, registerEntityReadTool } from "./read-tools.js";

export function registerBusinessTools(server: McpServer, client: KimaiClient): void {
  registerCollectionReadTool(server, client, {
    name: "kimai_list_teams",
    title: "List Kimai Teams",
    description: "List Kimai teams from /api/teams. This tool is read-only.",
    inputSchema: CollectionSchema.shape,
    path: () => "/api/teams",
    preferredFields: ["id", "name"],
    heading: "Kimai Teams"
  });

  registerEntityReadTool(server, client, {
    name: "kimai_get_team",
    title: "Get Kimai Team",
    description: "Read one Kimai team from /api/teams/<id>. This tool is read-only.",
    inputSchema: EntityIdSchema.shape,
    path: (params) => `/api/teams/${encodeURIComponent(String(params.id))}`,
    preferredFields: ["id", "name"],
    heading: "Kimai Team"
  });

  registerCollectionReadTool(server, client, {
    name: "kimai_list_invoices",
    title: "List Kimai Invoices",
    description: "List Kimai invoices from /api/invoices. This tool is read-only.",
    inputSchema: SearchableCollectionSchema.shape,
    path: () => "/api/invoices",
    query: (params) => ({
      term: params.term,
      orderBy: params.order_by,
      order: params.order
    }),
    preferredFields: ["id", "invoiceNumber", "customer", "user", "total", "createdAt", "status"],
    heading: "Kimai Invoices"
  });

  registerEntityReadTool(server, client, {
    name: "kimai_get_invoice",
    title: "Get Kimai Invoice",
    description: "Read one Kimai invoice from /api/invoices/<id>. This tool is read-only.",
    inputSchema: EntityIdSchema.shape,
    path: (params) => `/api/invoices/${encodeURIComponent(String(params.id))}`,
    preferredFields: ["id", "invoiceNumber", "customer", "user", "total", "createdAt", "status"],
    heading: "Kimai Invoice"
  });
}
