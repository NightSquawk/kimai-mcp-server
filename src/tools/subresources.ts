import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KimaiClient } from "../services/kimai-client.js";
import {
  CommentActionSchema,
  CommentCreateSchema,
  CommentListSchema,
  InvoiceCustomFieldsSchema,
  MetaUpdateSchema,
  RateCreateSchema,
  RateDeleteSchema,
  RateListSchema,
  TeamAssignmentSchema
} from "../schemas/crud.js";
import { DeleteEntitySchema } from "../schemas/crud.js";
import { registerCollectionReadTool } from "./read-tools.js";
import { registerDeleteTool, registerWriteTool } from "./write-tools.js";

/**
 * Tools for Kimai's repeated sub-resources.
 *
 * Rates, comments, meta fields, and team assignments have identical shapes
 * across several parent entities, so the parent is a parameter rather than
 * part of the tool name. Twelve near-identical tools would cost twelve tool
 * definitions of context for no added expressiveness; this follows the same
 * convention as the other NightSquawk servers, where `service` is a parameter
 * rather than baked into the tool name.
 */

/** Tool-facing entity names to their Kimai URL segments. */
const ENTITY_SEGMENT: Record<string, string> = {
  customer: "customers",
  project: "projects",
  activity: "activities",
  timesheet: "timesheets"
};

/** Team assignment kinds to their Kimai URL segments. */
const ASSIGNMENT_SEGMENT: Record<string, string> = {
  member: "members",
  customer: "customers",
  project: "projects",
  activity: "activities"
};

function segment(params: Record<string, unknown>): string {
  return ENTITY_SEGMENT[String(params.entity)] ?? "customers";
}

function entityPath(params: Record<string, unknown>): string {
  return `/api/${segment(params)}/${encodeURIComponent(String(params.id))}`;
}

export function registerSubresourceTools(server: McpServer, client: KimaiClient): void {
  registerRateTools(server, client);
  registerCommentTools(server, client);
  registerMetaTools(server, client);
  registerTeamAssignmentTools(server, client);
  registerInvoiceWriteTools(server, client);
}

// -------------------------------------------------------------------- rates

function registerRateTools(server: McpServer, client: KimaiClient): void {
  registerCollectionReadTool(server, client, {
    name: "kimai_list_rates",
    title: "List Kimai Rates",
    description:
      "List the configured rates for a Kimai customer, project, or activity. These are the rates that determine what booked time is worth, so read them before quoting or reconciling a margin. This tool is read-only.",
    inputSchema: RateListSchema.shape,
    path: (params) => `${entityPath(params)}/rates`,
    preferredFields: ["id", "user", "rate", "internalRate", "isFixed"],
    heading: "Kimai Rates",
    paginated: false
  });

  registerWriteTool(server, client, {
    name: "kimai_add_rate",
    title: "Add Kimai Rate",
    description:
      "Add a rate to a Kimai customer, project, or activity. Sensitive edit: call only after explicit human authorization. Omit user for a rate that applies to everyone. Changing rates affects what future time is billed at. The request and created rate are saved to a temp backup file.",
    inputSchema: RateCreateSchema.shape,
    method: "POST",
    path: (params) => `${entityPath(params)}/rates`,
    beforePath: (params) => `${entityPath(params)}/rates`,
    body: (params) => ({
      rate: params.rate,
      internalRate: params.internal_rate,
      isFixed: params.is_fixed,
      user: params.user
    }),
    preferredFields: ["id", "user", "rate", "internalRate", "isFixed"],
    heading: "Kimai Rate Added"
  });

  registerDeleteTool(server, client, {
    name: "kimai_delete_rate",
    title: "Delete Kimai Rate",
    description:
      "Delete one rate from a Kimai customer, project, or activity. Irreversible. Existing timesheets keep the rate they were booked at; only future calculations change. Requires KIMAI_ALLOW_DELETE=true plus explicit human authorization. The full rate list is saved to a temp backup file first.",
    inputSchema: RateDeleteSchema.shape,
    path: (params) => `${entityPath(params)}/rates/${encodeURIComponent(String(params.rate_id))}`,
    beforePath: (params) => `${entityPath(params)}/rates`,
    heading: "Kimai Rate Deleted"
  });
}

// ----------------------------------------------------------------- comments

function registerCommentTools(server: McpServer, client: KimaiClient): void {
  registerCollectionReadTool(server, client, {
    name: "kimai_list_comments",
    title: "List Kimai Comments",
    description:
      "List comments on a Kimai customer or project. Activities do not support comments. This tool is read-only.",
    inputSchema: CommentListSchema.shape,
    path: (params) => `${entityPath(params)}/comments`,
    preferredFields: ["id", "message", "pinned", "createdAt", "createdBy"],
    heading: "Kimai Comments",
    paginated: false
  });

  registerWriteTool(server, client, {
    name: "kimai_add_comment",
    title: "Add Kimai Comment",
    description:
      "Add a comment to a Kimai customer or project. Markdown is supported. Sensitive edit: call only after explicit human authorization. The request and created comment are saved to a temp backup file.",
    inputSchema: CommentCreateSchema.shape,
    method: "POST",
    path: (params) => `${entityPath(params)}/comments`,
    body: (params) => ({ message: params.message, pinned: params.pinned }),
    preferredFields: ["id", "message", "pinned", "createdAt", "createdBy"],
    heading: "Kimai Comment Added"
  });

  registerWriteTool(server, client, {
    name: "kimai_pin_comment",
    title: "Toggle Kimai Comment Pin",
    description:
      "Toggle the pinned state of a comment on a Kimai customer or project. Pinned comments always appear first. This is a toggle, not a set: calling it twice returns the comment to its original state. Sensitive edit: call only after explicit human authorization.",
    inputSchema: CommentActionSchema.shape,
    method: "PATCH",
    path: (params) => `${entityPath(params)}/comments/${encodeURIComponent(String(params.comment_id))}/pin`,
    preferredFields: ["id", "message", "pinned"],
    heading: "Kimai Comment Pin Toggled"
  });

  registerDeleteTool(server, client, {
    name: "kimai_delete_comment",
    title: "Delete Kimai Comment",
    description:
      "Delete a comment from a Kimai customer or project. Irreversible. Requires KIMAI_ALLOW_DELETE=true plus explicit human authorization. The comment list is saved to a temp backup file first.",
    inputSchema: CommentActionSchema.shape,
    path: (params) => `${entityPath(params)}/comments/${encodeURIComponent(String(params.comment_id))}`,
    beforePath: (params) => `${entityPath(params)}/comments`,
    heading: "Kimai Comment Deleted"
  });
}

// -------------------------------------------------------------- meta fields

function registerMetaTools(server: McpServer, client: KimaiClient): void {
  registerWriteTool(server, client, {
    name: "kimai_update_meta_field",
    title: "Update Kimai Meta Field",
    description:
      "Set a custom meta-field value on a Kimai customer, project, activity, or timesheet. Sensitive edit: call only after explicit human authorization. Kimai cannot create meta-fields through the API: the field must already be configured, otherwise this returns 404 for an unknown meta-field. The prior record is saved to a temp backup file.",
    inputSchema: MetaUpdateSchema.shape,
    method: "PATCH",
    path: (params) => `${entityPath(params)}/meta`,
    beforePath: (params) => entityPath(params),
    body: (params) => ({ name: params.name, value: params.value }),
    preferredFields: ["id", "name", "metaFields"],
    heading: "Kimai Meta Field Updated"
  });
}

// --------------------------------------------------------- team assignments

function registerTeamAssignmentTools(server: McpServer, client: KimaiClient): void {
  const assignmentPath = (params: Record<string, unknown>) => {
    const kind = ASSIGNMENT_SEGMENT[String(params.kind)] ?? "members";
    return `/api/teams/${encodeURIComponent(String(params.id))}/${kind}/${encodeURIComponent(String(params.target_id))}`;
  };

  registerWriteTool(server, client, {
    name: "kimai_add_team_assignment",
    title: "Add Kimai Team Assignment",
    description:
      "Grant a Kimai team access to a user, customer, project, or activity. This is the supported way to give a team access to an entity: the older POST /api/customers/<id>/team style endpoints were removed upstream and now return 410. Sensitive edit: call only after explicit human authorization.",
    inputSchema: TeamAssignmentSchema.shape,
    method: "POST",
    path: assignmentPath,
    beforePath: (params) => `/api/teams/${encodeURIComponent(String(params.id))}`,
    preferredFields: ["id", "name", "members", "customers", "projects", "activities"],
    heading: "Kimai Team Assignment Added"
  });

  registerDeleteTool(server, client, {
    name: "kimai_remove_team_assignment",
    title: "Remove Kimai Team Assignment",
    description:
      "Revoke a Kimai team's access to a user, customer, project, or activity. Irreversible in the sense that it is not undone automatically, but the assignment can be re-added. Removing the last teamlead is rejected by Kimai. Requires KIMAI_ALLOW_DELETE=true plus explicit human authorization.",
    inputSchema: TeamAssignmentSchema.shape,
    path: assignmentPath,
    beforePath: (params) => `/api/teams/${encodeURIComponent(String(params.id))}`,
    heading: "Kimai Team Assignment Removed"
  });
}

// ----------------------------------------------------------------- invoices

function registerInvoiceWriteTools(server: McpServer, client: KimaiClient): void {
  // Kimai reads this body with $request->request->all(), so it must be a bare
  // JSON array of {name, value} rather than an object.
  registerWriteTool(server, client, {
    name: "kimai_update_invoice_custom_fields",
    title: "Update Kimai Invoice Custom Fields",
    description:
      "Set configured custom-field values on a Kimai invoice via PATCH /api/invoices/<id>/custom-fields. Sensitive edit: call only after explicit human authorization. Only fields that already exist can be set; unknown names are rejected. The prior invoice is saved to a temp backup file.",
    inputSchema: InvoiceCustomFieldsSchema.shape,
    method: "PATCH",
    path: (params) => `/api/invoices/${encodeURIComponent(String(params.id))}/custom-fields`,
    beforePath: (params) => `/api/invoices/${encodeURIComponent(String(params.id))}`,
    body: (params) => params.fields as unknown[],
    preferredFields: ["id", "invoiceNumber", "customer", "total", "status"],
    heading: "Kimai Invoice Custom Fields Updated"
  });

  registerDeleteTool(server, client, {
    name: "kimai_delete_export_template",
    title: "Delete Kimai Export Template",
    description:
      "Delete a Kimai export template via DELETE /api/export/<id>. Irreversible. Removes the template only; exported timesheet data is untouched. Requires KIMAI_ALLOW_DELETE=true plus explicit human authorization.",
    inputSchema: DeleteEntitySchema.shape,
    path: (params) => `/api/export/${encodeURIComponent(String(params.id))}`,
    heading: "Kimai Export Template Deleted"
  });
}
