import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import { DELETE_GATE_MESSAGE } from "../constants.js";
import type { KimaiClient } from "../services/kimai-client.js";
import { formatApiError } from "../services/errors.js";
import { writeMutationBackup } from "../services/backups.js";
import type { ResponseFormat } from "../types.js";
import { formatResponse, makeToolResponse } from "./format.js";

type ToolParams = Record<string, unknown>;

interface DeleteToolOptions {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  path: (params: ToolParams) => string;
  /**
   * Path to read before deleting. Strongly recommended: after the delete the
   * backup file is the only remaining copy of the record.
   */
  beforePath?: (params: ToolParams) => string;
  /**
   * Snapshot the dependent records a cascading delete will also destroy.
   * Returned object is merged into the backup file alongside `before`.
   */
  cascade?: (client: KimaiClient, params: ToolParams) => Promise<Record<string, unknown>>;
  heading: string;
}

/**
 * Register an irreversible delete.
 *
 * Three layers run in a fixed order, and the order is the point:
 *
 *   1. KIMAI_ALLOW_DELETE must be enabled. Checked first, before any network
 *      call, so a server that never opted in cannot be talked into a delete.
 *   2. The schema's authorization_confirmed/authorization_note must be present.
 *   3. The record, plus anything a cascading delete will take with it, is read
 *      and written to a backup file BEFORE the DELETE is sent. If the backup
 *      cannot be written the delete does not happen, since after a successful
 *      delete that file is the only copy left.
 *
 * Reordering or removing a layer is a defect, not a simplification.
 */
export function registerDeleteTool(server: McpServer, client: KimaiClient, options: DeleteToolOptions): void {
  server.registerTool(
    options.name,
    {
      title: options.title,
      description: options.description,
      inputSchema: options.inputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: ToolParams) => {
      if (!client.allowDelete) {
        const data = { error: DELETE_GATE_MESSAGE };
        return makeToolResponse(data, data.error, true);
      }

      try {
        const endpoint = options.path(params);
        const before = options.beforePath ? (await client.get<unknown>(options.beforePath(params))).data : undefined;
        const cascade = options.cascade ? await options.cascade(client, params) : undefined;

        const backupFile = await writeMutationBackup({
          operation: options.name,
          endpoint: `DELETE ${endpoint}`,
          authorization_note: String(params.authorization_note ?? ""),
          before,
          request: cascade
        });

        await client.delete<unknown>(endpoint);

        const data = { backup_file: backupFile, deleted: before ?? { endpoint }, cascade, endpoint };
        const cascadeLines = cascade
          ? [
              "",
              `Cascade captured: ${Object.entries(cascade)
                .map(([key, value]) => `${key}=${Array.isArray(value) ? value.length : String(value)}`)
                .join(", ")}`
            ]
          : [];
        const markdown = [
          `# ${options.heading}`,
          "",
          `Deleted ${endpoint}. Kimai returned 204 No Content.`,
          "",
          `Backup file: ${backupFile}`,
          ...cascadeLines,
          "",
          "This backup is the only remaining copy of the deleted records. Kimai has no undo for deletes."
        ].join("\n");

        return makeToolResponse(data, formatResponse(params.response_format as ResponseFormat, data, markdown));
      } catch (error) {
        const data = { error: formatApiError(error) };
        return makeToolResponse(data, data.error, true);
      }
    }
  );
}
