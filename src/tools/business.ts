import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KimaiClient } from "../services/kimai-client.js";
import { formatApiError } from "../services/errors.js";
import { writeDownload } from "../services/downloads.js";
import { EntityIdSchema, InvoiceCollectionSchema, UnpaginatedCollectionSchema } from "../schemas/resources.js";
import type { ResponseFormat } from "../types.js";
import { formatResponse, makeToolResponse, summarizeRecord } from "./format.js";
import { registerCollectionReadTool, registerEntityReadTool } from "./read-tools.js";
import { list } from "./query.js";

const INVOICE_FIELDS = ["id", "invoiceNumber", "customer", "user", "total", "tax", "currency", "createdAt", "status", "overdue"];

export function registerBusinessTools(server: McpServer, client: KimaiClient): void {
  // /api/teams declares no query parameters at all, so page/size were being
  // sent and ignored while the response envelope reported a page number Kimai
  // never applied.
  registerCollectionReadTool(server, client, {
    name: "kimai_list_teams",
    title: "List Kimai Teams",
    description: "List Kimai teams from /api/teams. This endpoint returns every visible team and does not paginate. This tool is read-only.",
    inputSchema: UnpaginatedCollectionSchema.shape,
    path: () => "/api/teams",
    preferredFields: ["id", "name"],
    heading: "Kimai Teams",
    paginated: false
  });

  registerEntityReadTool(server, client, {
    name: "kimai_get_team",
    title: "Get Kimai Team",
    description: "Read one Kimai team from /api/teams/<id>, including members and granted customers, projects, and activities. This tool is read-only.",
    inputSchema: EntityIdSchema.shape,
    path: (params) => `/api/teams/${encodeURIComponent(String(params.id))}`,
    preferredFields: ["id", "name", "members", "customers", "projects", "activities"],
    heading: "Kimai Team"
  });

  registerCollectionReadTool(server, client, {
    name: "kimai_list_invoices",
    title: "List Kimai Invoices",
    description:
      "List Kimai invoices from /api/invoices, optionally filtered by creation date range, customers, or status. This tool is read-only.",
    inputSchema: InvoiceCollectionSchema.shape,
    path: () => "/api/invoices",
    query: (params) => ({
      begin: params.begin,
      end: params.end,
      customers: list(params.customers),
      status: list(params.status)
    }),
    preferredFields: INVOICE_FIELDS,
    heading: "Kimai Invoices"
  });

  registerEntityReadTool(server, client, {
    name: "kimai_get_invoice",
    title: "Get Kimai Invoice",
    description: "Read one Kimai invoice from /api/invoices/<id>. This tool is read-only.",
    inputSchema: EntityIdSchema.shape,
    path: (params) => `/api/invoices/${encodeURIComponent(String(params.id))}`,
    preferredFields: INVOICE_FIELDS,
    heading: "Kimai Invoice"
  });

  server.registerTool(
    "kimai_download_invoice",
    {
      title: "Download Kimai Invoice",
      description:
        "Download the rendered invoice document from /api/invoices/<id>/download and save it to the OS temp directory. Returns the local file path, not the document contents. This tool is read-only.",
      inputSchema: EntityIdSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: Record<string, unknown>) => {
      try {
        const id = encodeURIComponent(String(params.id));
        const download = await client.getBinary(`/api/invoices/${id}/download`);
        const filename = download.filename ?? `kimai-invoice-${id}`;
        const path = await writeDownload(filename, download.data);

        const data = {
          path,
          bytes: download.data.length,
          content_type: download.contentType ?? null,
          filename
        };
        const markdown = [
          "# Kimai Invoice Downloaded",
          "",
          `Saved to: ${path}`,
          `Size: ${data.bytes} bytes`,
          `Content type: ${data.content_type ?? "unknown"}`
        ].join("\n");

        return makeToolResponse(data, formatResponse(params.response_format as ResponseFormat, data, markdown));
      } catch (error) {
        const data = { error: formatApiError(error) };
        return makeToolResponse(data, data.error, true);
      }
    }
  );
}
