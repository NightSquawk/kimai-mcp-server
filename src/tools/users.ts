import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KimaiClient } from "../services/kimai-client.js";
import { formatApiError } from "../services/errors.js";
import { CollectionSchema, EntityIdSchema } from "../schemas/resources.js";
import { ServerInfoSchema, type ServerInfoInput } from "../schemas/server.js";
import { formatResponse, makeToolResponse, summarizeRecord } from "./format.js";
import { registerCollectionReadTool, registerEntityReadTool } from "./read-tools.js";

export function registerUserTools(server: McpServer, client: KimaiClient): void {
  server.registerTool(
    "kimai_get_current_user",
    {
      title: "Get Current Kimai User",
      description: "Read the current Kimai user from /api/users/me. This tool is read-only.",
      inputSchema: ServerInfoSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ response_format }: ServerInfoInput) => {
      try {
        const response = await client.get<unknown>("/api/users/me");
        const data = { user: response.data };
        const markdown = ["# Current Kimai User", "", summarizeRecord(response.data, ["id", "username", "alias", "email", "enabled"])].join("\n");
        return makeToolResponse(data, formatResponse(response_format, data, markdown));
      } catch (error) {
        const data = { error: formatApiError(error) };
        return makeToolResponse(data, data.error, true);
      }
    }
  );

  registerCollectionReadTool(server, client, {
    name: "kimai_list_users",
    title: "List Kimai Users",
    description: "List Kimai users visible to the API token from /api/users. This tool is read-only.",
    inputSchema: CollectionSchema.shape,
    path: () => "/api/users",
    preferredFields: ["id", "username", "alias", "email", "enabled"],
    heading: "Kimai Users"
  });

  registerEntityReadTool(server, client, {
    name: "kimai_get_user",
    title: "Get Kimai User",
    description: "Read one Kimai user from /api/users/<id>. This tool is read-only.",
    inputSchema: EntityIdSchema.shape,
    path: (params) => `/api/users/${encodeURIComponent(String(params.id))}`,
    preferredFields: ["id", "username", "alias", "email", "enabled"],
    heading: "Kimai User"
  });
}
