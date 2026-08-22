import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KimaiClient } from "../services/kimai-client.js";
import { formatApiError } from "../services/errors.js";
import { ServerInfoSchema, type ServerInfoInput } from "../schemas/server.js";
import { formatResponse, makeToolResponse, summarizeRecord } from "./format.js";

const USER_FIELDS = ["id", "username", "alias", "email", "enabled", "title", "accountNumber"];

export function registerUserTools(server: McpServer, client: KimaiClient): void {
  server.registerTool(
    "kimai_get_current_user",
    {
      title: "Get Current Kimai User",
      description: "Read the current Kimai user from /api/users/me, including roles, teams, and preferences. This tool is read-only.",
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
        const markdown = ["# Current Kimai User", "", summarizeRecord(response.data, USER_FIELDS)].join("\n");
        return makeToolResponse(data, formatResponse(response_format, data, markdown));
      } catch (error) {
        const data = { error: formatApiError(error) };
        return makeToolResponse(data, data.error, true);
      }
    }
  );


}
