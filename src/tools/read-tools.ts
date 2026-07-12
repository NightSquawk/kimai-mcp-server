import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import type { KimaiClient } from "../services/kimai-client.js";
import { formatApiError } from "../services/errors.js";
import type { ResponseFormat } from "../types.js";
import { formatResponse, makeToolResponse, paginateResponse, summarizeRecord } from "./format.js";

type ToolParams = Record<string, unknown>;

type CollectionReadOptions = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  path: (params: ToolParams) => string;
  query?: (params: ToolParams) => Record<string, unknown> | undefined;
  preferredFields: string[];
  heading: string;
};

type CollectionParams = {
  page: number;
  size: number;
  response_format: ResponseFormat;
};

export function registerCollectionReadTool(
  server: McpServer,
  client: KimaiClient,
  options: CollectionReadOptions
): void {
  server.registerTool(
    options.name,
    {
      title: options.title,
      description: options.description,
      inputSchema: options.inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: ToolParams) => {
      try {
        const paging = params as CollectionParams;
        const response = await client.get<unknown>(options.path(params), {
          page: paging.page,
          size: paging.size,
          ...options.query?.(params)
        });
        const data = paginateResponse(response, paging.page, paging.size);
        const markdown = [
          `# ${options.heading}`,
          "",
          `Showing ${data.count} of ${data.total} records on page ${data.page}.`,
          "",
          ...data.items.map((item) => `- ${summarizeRecord(item, options.preferredFields)}`)
        ].join("\n");

        return makeToolResponse(data, formatResponse(paging.response_format, data, markdown));
      } catch (error) {
        const data = { error: formatApiError(error) };
        return makeToolResponse(data, data.error, true);
      }
    }
  );
}

export function registerEntityReadTool(
  server: McpServer,
  client: KimaiClient,
  options: Omit<CollectionReadOptions, "query" | "preferredFields"> & { preferredFields: string[] }
): void {
  server.registerTool(
    options.name,
    {
      title: options.title,
      description: options.description,
      inputSchema: options.inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: ToolParams) => {
      try {
        const responseFormat = params.response_format as ResponseFormat;
        const response = await client.get<unknown>(options.path(params));
        const data = { item: response.data };
        const markdown = [
          `# ${options.heading}`,
          "",
          summarizeRecord(response.data, options.preferredFields)
        ].join("\n");

        return makeToolResponse(data, formatResponse(responseFormat, data, markdown));
      } catch (error) {
        const data = { error: formatApiError(error) };
        return makeToolResponse(data, data.error, true);
      }
    }
  );
}
