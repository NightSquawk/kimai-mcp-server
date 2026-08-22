import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KimaiClient } from "../services/kimai-client.js";
import { formatApiError } from "../services/errors.js";
import { ServerInfoSchema, type ServerInfoInput } from "../schemas/server.js";
import { formatResponse, makeToolResponse } from "./format.js";

export function registerServerTools(server: McpServer, client: KimaiClient): void {
  server.registerTool(
    "kimai_get_server_info",
    {
      title: "Get Kimai Server Info",
      description: "Read Kimai API status, version, installed plugins, timesheet configuration, and the configured color palette. This tool is read-only.",
      inputSchema: ServerInfoSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ response_format }: ServerInfoInput) => {
      const checks = await Promise.allSettled([
        client.get<unknown>("/api/ping"),
        client.get<unknown>("/api/version"),
        client.get<unknown>("/api/plugins"),
        client.get<unknown>("/api/config/timesheet"),
        client.get<unknown>("/api/config/colors")
      ]);

      const [ping, version, plugins, timesheetConfig, colors] = checks.map((result) =>
        result.status === "fulfilled" ? result.value.data : { error: formatApiError(result.reason) }
      );
      const data = { ping, version, plugins, timesheet_config: timesheetConfig, colors };
      const markdown = [
        "# Kimai Server Info",
        "",
        `- Ping: ${formatInline(ping)}`,
        `- Version: ${formatInline(version)}`,
        `- Plugins: ${formatInline(plugins)}`,
        `- Timesheet config: ${formatInline(timesheetConfig)}`,
        `- Colors: ${formatInline(colors)}`
      ].join("\n");

      return makeToolResponse(data, formatResponse(response_format, data, markdown));
    }
  );
}

function formatInline(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}
