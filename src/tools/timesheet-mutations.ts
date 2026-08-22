import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KimaiClient } from "../services/kimai-client.js";
import { writeMutationBackup } from "../services/backups.js";
import { TimesheetIdActionSchema } from "../schemas/mutations.js";
import { registerDeleteTool, registerWriteTool } from "./write-tools.js";
import { formatApiError } from "../services/errors.js";
import {
  CreateTimesheetSchema,
  DuplicateTimesheetSchema,
  TimesheetStateChangeSchema,
  UpdateTimesheetSchema,
  type CreateTimesheetInput,
  type DuplicateTimesheetInput,
  type TimesheetStateChangeInput,
  type UpdateTimesheetInput
} from "../schemas/mutations.js";
import { formatResponse, makeToolResponse, summarizeRecord } from "./format.js";

export function registerTimesheetMutationTools(server: McpServer, client: KimaiClient): void {
  server.registerTool(
    "kimai_create_timesheet",
    {
      title: "Create Kimai Timesheet",
      description: "Create a Kimai timesheet record. Sensitive edit: call only after explicit human authorization. The request and created record are saved to a temp backup file.",
      inputSchema: CreateTimesheetSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: CreateTimesheetInput) => {
      try {
        const payload = buildTimesheetPayload(params, ["authorization_confirmed", "authorization_note", "full", "response_format"]);
        const response = await client.post<unknown>("/api/timesheets", payload, params.full ? { full: "true" } : undefined);
        const backupFile = await writeMutationBackup({
          operation: "kimai_create_timesheet",
          endpoint: "POST /api/timesheets",
          authorization_note: params.authorization_note,
          before: null,
          request: payload,
          after: response.data
        });
        const data = { backup_file: backupFile, timesheet: response.data };
        const markdown = [
          "# Kimai Timesheet Created",
          "",
          `Backup file: ${backupFile}`,
          "",
          summarizeRecord(response.data, ["id", "user", "project", "activity", "begin", "end", "duration", "description"])
        ].join("\n");

        return makeToolResponse(data, formatResponse(params.response_format, data, markdown));
      } catch (error) {
        const data = { error: formatApiError(error) };
        return makeToolResponse(data, data.error, true);
      }
    }
  );

  server.registerTool(
    "kimai_update_timesheet",
    {
      title: "Update Kimai Timesheet",
      description: "Update a Kimai timesheet record. Sensitive edit: call only after explicit human authorization. The existing record is saved to a temp backup file before the edit.",
      inputSchema: UpdateTimesheetSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: UpdateTimesheetInput) => {
      try {
        const payload = buildTimesheetPayload(params, ["authorization_confirmed", "authorization_note", "id", "response_format"]);
        if (Object.keys(payload).length === 0) {
          return makeToolResponse({ error: "No editable fields were provided." }, "No editable fields were provided.", true);
        }

        const endpoint = `/api/timesheets/${encodeURIComponent(String(params.id))}`;
        const before = await client.get<unknown>(endpoint);
        const response = await client.patch<unknown>(endpoint, payload);
        const backupFile = await writeMutationBackup({
          operation: "kimai_update_timesheet",
          endpoint: `PATCH ${endpoint}`,
          authorization_note: params.authorization_note,
          before: before.data,
          request: payload,
          after: response.data
        });
        const data = { backup_file: backupFile, before: before.data, timesheet: response.data };
        const markdown = [
          "# Kimai Timesheet Updated",
          "",
          `Backup file: ${backupFile}`,
          "",
          summarizeRecord(response.data, ["id", "user", "project", "activity", "begin", "end", "duration", "description"])
        ].join("\n");

        return makeToolResponse(data, formatResponse(params.response_format, data, markdown));
      } catch (error) {
        const data = { error: formatApiError(error) };
        return makeToolResponse(data, data.error, true);
      }
    }
  );

  server.registerTool(
    "kimai_stop_timesheet",
    {
      title: "Stop Kimai Timesheet",
      description: "Stop an active Kimai timesheet. Sensitive edit: call only after explicit human authorization. The existing record is saved to a temp backup file before stopping.",
      inputSchema: TimesheetStateChangeSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: TimesheetStateChangeInput) => runStateChange(client, params, "kimai_stop_timesheet", "stop")
  );

  server.registerTool(
    "kimai_restart_timesheet",
    {
      title: "Restart Kimai Timesheet",
      description: "Restart a stopped Kimai timesheet. Sensitive edit: call only after explicit human authorization. The existing record is saved to a temp backup file before restarting.",
      inputSchema: TimesheetStateChangeSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: TimesheetStateChangeInput) => runStateChange(client, params, "kimai_restart_timesheet", "restart")
  );

  server.registerTool(
    "kimai_duplicate_timesheet",
    {
      title: "Duplicate Kimai Timesheet",
      description: "Duplicate an existing Kimai timesheet. Sensitive edit: call only after explicit human authorization. The source and created record are saved to a temp backup file.",
      inputSchema: DuplicateTimesheetSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: DuplicateTimesheetInput) => {
      try {
        const sourceEndpoint = `/api/timesheets/${encodeURIComponent(String(params.id))}`;
        const before = await client.get<unknown>(sourceEndpoint);
        const response = await client.patch<unknown>(`${sourceEndpoint}/duplicate`);
        const backupFile = await writeMutationBackup({
          operation: "kimai_duplicate_timesheet",
          endpoint: `PATCH ${sourceEndpoint}/duplicate`,
          authorization_note: params.authorization_note,
          before: before.data,
          after: response.data
        });
        const data = { backup_file: backupFile, source: before.data, timesheet: response.data };
        const markdown = [
          "# Kimai Timesheet Duplicated",
          "",
          `Backup file: ${backupFile}`,
          "",
          summarizeRecord(response.data, ["id", "user", "project", "activity", "begin", "end", "duration", "description"])
        ].join("\n");

        return makeToolResponse(data, formatResponse(params.response_format, data, markdown));
      } catch (error) {
        const data = { error: formatApiError(error) };
        return makeToolResponse(data, data.error, true);
      }
    }
  );
  registerWriteTool(server, client, {
    name: "kimai_toggle_timesheet_export",
    title: "Toggle Kimai Timesheet Export State",
    description:
      "Toggle the exported flag on a Kimai timesheet via PATCH /api/timesheets/<id>/export. Exported records are locked and can no longer be edited, which is how time is frozen once it has been invoiced. This is a toggle, not a set: calling it twice returns the record to its original state. Sensitive edit: call only after explicit human authorization. The prior record is saved to a temp backup file.",
    inputSchema: TimesheetIdActionSchema.shape,
    method: "PATCH",
    path: (params) => `/api/timesheets/${encodeURIComponent(String(params.id))}/export`,
    beforePath: (params) => `/api/timesheets/${encodeURIComponent(String(params.id))}`,
    preferredFields: ["id", "user", "project", "activity", "begin", "end", "duration", "exported"],
    heading: "Kimai Timesheet Export State Toggled"
  });

  registerDeleteTool(server, client, {
    name: "kimai_delete_timesheet",
    title: "Delete Kimai Timesheet",
    description:
      "Delete a Kimai timesheet entry via DELETE /api/timesheets/<id>. IRREVERSIBLE: Kimai has no undo and the entry is removed from every future report and invoice. Requires KIMAI_ALLOW_DELETE=true on the server plus explicit human authorization. The full record is saved to a temp backup file before the delete, and that file is the only remaining copy afterwards. To correct a mistaken entry without losing it, prefer kimai_update_timesheet.",
    inputSchema: TimesheetIdActionSchema.shape,
    path: (params) => `/api/timesheets/${encodeURIComponent(String(params.id))}`,
    beforePath: (params) => `/api/timesheets/${encodeURIComponent(String(params.id))}`,
    heading: "Kimai Timesheet Deleted"
  });

}

async function runStateChange(
  client: KimaiClient,
  params: TimesheetStateChangeInput,
  operation: string,
  action: "stop" | "restart"
) {
  try {
    const sourceEndpoint = `/api/timesheets/${encodeURIComponent(String(params.id))}`;
    const before = await client.get<unknown>(sourceEndpoint);
    const request = action === "restart" && params.begin ? { begin: params.begin } : undefined;
    const response = await client.patch<unknown>(`${sourceEndpoint}/${action}`, request);
    const backupFile = await writeMutationBackup({
      operation,
      endpoint: `PATCH ${sourceEndpoint}/${action}`,
      authorization_note: params.authorization_note,
      before: before.data,
      request,
      after: response.data
    });
    const data = { backup_file: backupFile, before: before.data, timesheet: response.data };
    const markdown = [
      `# Kimai Timesheet ${action === "stop" ? "Stopped" : "Restarted"}`,
      "",
      `Backup file: ${backupFile}`,
      "",
      summarizeRecord(response.data, ["id", "user", "project", "activity", "begin", "end", "duration", "description"])
    ].join("\n");

    return makeToolResponse(data, formatResponse(params.response_format, data, markdown));
  } catch (error) {
    const data = { error: formatApiError(error) };
    return makeToolResponse(data, data.error, true);
  }
}

function buildTimesheetPayload(params: Record<string, unknown>, excludedKeys: string[]): Record<string, unknown> {
  const excluded = new Set(excludedKeys);
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (excluded.has(key) || value === undefined || value === null || value === "") continue;
    payload[toKimaiFieldName(key)] = Array.isArray(value) ? value.join(",") : value;
  }

  return payload;
}

function toKimaiFieldName(key: string): string {
  if (key === "fixed_rate") return "fixedRate";
  if (key === "hourly_rate") return "hourlyRate";
  return key;
}
