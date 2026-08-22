import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadIndex } from "../../catalog/endpoint-spec.js";
import { formatApiError } from "../../services/errors.js";
import { makeToolResponse } from "../format.js";

/**
 * kimai_list_endpoints: discovery over the generated 91-endpoint catalog.
 *
 * This is the first of the three catalog tools. It answers "what can this
 * server reach?" without registering a tool per operation. A caller narrows
 * with category/resource/method/search, takes an operationId from the result,
 * passes it to kimai_describe_endpoint for the exact parameters, and then to
 * kimai_call_endpoint to execute.
 *
 * WHAT THIS TOOL COVERS AND WHAT THE CURATED TOOLS COVER
 * -------------------------------------------------------
 * The catalog holds every endpoint, INCLUDING the ones that also have a
 * curated tool. That overlap is deliberate rather than an oversight. The
 * curated timesheet tools exist because Kimai's timesheet filters have
 * measured failure modes that a Zod description can warn about and a generic
 * catalog entry cannot; they are not a different set of endpoints. Hiding
 * their operations from the catalog would mean a caller who found
 * kimai_list_timesheets unsuitable for some edge case had no way to reach
 * GET /api/timesheets at all. So both paths stay open, and the description
 * below points at the curated tools for the cases where they are better.
 *
 * `totals` and `categories` describe the whole catalog so a caller can see
 * what is available to filter on; `matched`/`shown`/`truncated` describe this
 * query's result set. Nothing here reads process.env or touches the network:
 * it is a pure read of the on-disk index, so it works and returns the same
 * answer on a machine with no Kimai credentials configured at all.
 */

const ListEndpointsSchema = z.object({
  category: z
    .string()
    .optional()
    .describe("Filter by category, e.g. Timesheet, Customer, Project, Team, Invoice. Call with no arguments to see every category."),
  resource: z
    .string()
    .optional()
    .describe("Filter by resource, the first path segment after /api, e.g. 'timesheets', 'customers'."),
  method: z
    .string()
    .optional()
    .describe("Filter by HTTP method: GET, POST, PATCH, PUT, DELETE."),
  reads_only: z.boolean().optional().describe("Only read (GET) endpoints."),
  writes_only: z.boolean().optional().describe("Only write (POST/PATCH/PUT/DELETE) endpoints."),
  destructive_only: z.boolean().optional().describe("Only endpoints flagged destructive. All 18 are DELETEs."),
  search: z
    .string()
    .optional()
    .describe("Case-insensitive substring match on operationId, path, name, or description."),
  limit: z.number().int().positive().max(500).optional().describe("Maximum endpoints to return. Defaults to 200.")
}).strict();

export function registerListEndpointsTool(server: McpServer): void {
  server.registerTool(
    "kimai_list_endpoints",
    {
      title: "List Kimai API Endpoints",
      description:
        "Discover any of the 91 Kimai API endpoints this server can reach: operationId, method, path, category, " +
        "description, and read/write/destructive flags. Filter by category, resource, method, reads/writes, or a " +
        "search term. Use this for anything outside the curated tools, then kimai_describe_endpoint for the exact " +
        "parameters and kimai_call_endpoint to execute. For routine timesheet reporting prefer the curated " +
        "kimai_list_timesheets instead: it carries warnings about Kimai filter behavior that this generic path " +
        "cannot. This tool is read-only and never contacts the Kimai server.",
      inputSchema: ListEndpointsSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        // No network call at all: this reads a file that ships inside the package.
        openWorldHint: false
      }
    },
    async (params) => {
      try {
        const index = loadIndex();

        const category = params.category?.toLowerCase();
        const resource = params.resource?.toLowerCase();
        const method = params.method?.toUpperCase();
        const search = params.search?.toLowerCase();

        let endpoints = index.endpoints;
        if (category) endpoints = endpoints.filter((e) => e.category.toLowerCase() === category);
        if (resource) endpoints = endpoints.filter((e) => e.resource.toLowerCase() === resource);
        if (method) endpoints = endpoints.filter((e) => e.method === method);
        if (params.reads_only) endpoints = endpoints.filter((e) => !e.writeOperation);
        if (params.writes_only) endpoints = endpoints.filter((e) => e.writeOperation);
        if (params.destructive_only) endpoints = endpoints.filter((e) => e.destructive);
        if (search) {
          endpoints = endpoints.filter(
            (e) =>
              e.operationId.toLowerCase().includes(search) ||
              e.path.toLowerCase().includes(search) ||
              e.name.toLowerCase().includes(search) ||
              e.description.toLowerCase().includes(search)
          );
        }

        const limit = params.limit ?? 200;
        const matched = endpoints.length;
        const shown = endpoints.slice(0, limit);
        const truncated = matched > limit;

        const data = {
          matched,
          shown: shown.length,
          truncated,
          totals: {
            endpoints: index.endpointCount,
            reads: index.readCount,
            writes: index.writeCount,
            destructive: index.destructiveCount
          },
          categories: index.categories,
          ...(truncated
            ? { note: `Showing ${shown.length} of ${matched}. Narrow with category/resource/method/search, or raise limit.` }
            : {}),
          endpoints: shown.map((e) => ({
            operation_id: e.operationId,
            method: e.method,
            path: e.path,
            name: e.name,
            category: e.category,
            resource: e.resource,
            description: e.description,
            write_operation: e.writeOperation,
            ...(e.destructive ? { destructive: true } : {}),
            ...(e.pluginOnly ? { plugin_only: true } : {})
          }))
        };

        const header = [
          `# Kimai API Endpoints`,
          "",
          `Matched ${matched}, showing ${shown.length} of ${index.endpointCount} total ` +
            `(${index.readCount} read, ${index.writeCount} write, ${index.destructiveCount} destructive).`,
          "",
          `Categories: ${index.categories.join(", ")}`,
          ""
        ];
        const rows = shown.map((e) => {
          const flags = [
            e.writeOperation ? "WRITE" : "read",
            ...(e.destructive ? ["DESTRUCTIVE"] : []),
            ...(e.pluginOnly ? ["plugin-only"] : [])
          ].join(" ");
          return `- \`${e.operationId}\` [${flags}] ${e.method} ${e.path} -- ${e.name}`;
        });
        const footer = truncated
          ? ["", `Showing ${shown.length} of ${matched}. Narrow the filters or raise limit.`]
          : [];
        const markdown = [...header, ...rows, ...footer].join("\n");

        return makeToolResponse(data, markdown);
      } catch (error) {
        const data = { error: formatApiError(error) };
        return makeToolResponse(data, data.error, true);
      }
    }
  );
}
