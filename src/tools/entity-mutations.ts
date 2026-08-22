import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KimaiClient } from "../services/kimai-client.js";
import { collectAffectedTimesheets, collectChildren } from "../services/cascade.js";
import {
  ActivityCreateSchema,
  ActivityUpdateSchema,
  CustomerCreateSchema,
  CustomerUpdateSchema,
  DeleteEntitySchema,
  ProjectCreateSchema,
  ProjectUpdateSchema,
  TagCreateSchema,
  TeamCreateSchema,
  TeamUpdateSchema,
  UserCreateSchema,
  UserPreferencesSchema,
  UserUpdateSchema
} from "../schemas/crud.js";
import { buildPayload } from "./payload.js";
import { registerDeleteTool, registerWriteTool } from "./write-tools.js";

/**
 * Create, update, and delete tools for Kimai master data.
 *
 * Every write carries the per-call authorization fields and a JSON backup.
 * Every delete additionally requires KIMAI_ALLOW_DELETE, and the three
 * cascading deletes (customer, project, activity) snapshot their dependent
 * timesheets first, because Kimai destroys those silently along with the
 * parent and offers no undo.
 */

const CONTROL_KEYS = ["authorization_confirmed", "authorization_note", "response_format", "id"];

const CUSTOMER_FIELDS = ["id", "name", "number", "company", "visible", "billable", "country", "currency"];
const PROJECT_FIELDS = ["id", "name", "customer", "visible", "billable", "orderNumber", "start", "end"];
const ACTIVITY_FIELDS = ["id", "name", "project", "visible", "billable"];
const TEAM_FIELDS = ["id", "name", "members"];
const USER_FIELDS = ["id", "username", "alias", "email", "enabled", "roles"];

export function registerEntityMutationTools(server: McpServer, client: KimaiClient): void {
  registerCustomerTools(server, client);
  registerProjectTools(server, client);
  registerActivityTools(server, client);
  registerTeamTools(server, client);
  registerTagTools(server, client);
  registerUserWriteTools(server, client);
}

// ---------------------------------------------------------------- customers

function registerCustomerTools(server: McpServer, client: KimaiClient): void {
  registerWriteTool(server, client, {
    name: "kimai_create_customer",
    title: "Create Kimai Customer",
    description:
      "Create a Kimai customer via POST /api/customers. Sensitive edit: call only after explicit human authorization. Kimai requires name, country, currency, and timezone. The request and created record are saved to a temp backup file.",
    inputSchema: CustomerCreateSchema.shape,
    method: "POST",
    path: () => "/api/customers",
    body: (params) => buildPayload(params, CONTROL_KEYS),
    preferredFields: CUSTOMER_FIELDS,
    heading: "Kimai Customer Created"
  });

  registerWriteTool(server, client, {
    name: "kimai_update_customer",
    title: "Update Kimai Customer",
    description:
      "Update a Kimai customer via PATCH /api/customers/<id>. Sensitive edit: call only after explicit human authorization. Prefer visible: false over deleting a customer, since deletion also removes its projects, activities, and timesheets. The prior record is saved to a temp backup file.",
    inputSchema: CustomerUpdateSchema.shape,
    method: "PATCH",
    path: (params) => `/api/customers/${encodeURIComponent(String(params.id))}`,
    beforePath: (params) => `/api/customers/${encodeURIComponent(String(params.id))}`,
    body: (params) => buildPayload(params, CONTROL_KEYS),
    preferredFields: CUSTOMER_FIELDS,
    heading: "Kimai Customer Updated"
  });

  registerDeleteTool(server, client, {
    name: "kimai_delete_customer",
    title: "Delete Kimai Customer",
    description:
      "Delete a Kimai customer via DELETE /api/customers/<id>. IRREVERSIBLE AND CASCADING: Kimai also deletes every linked project, activity, and timesheet, which destroys billing history. Requires KIMAI_ALLOW_DELETE=true plus explicit human authorization. Consider kimai_update_customer with visible: false instead. The customer, its projects, and all affected timesheets are saved to a temp backup file first.",
    inputSchema: DeleteEntitySchema.shape,
    path: (params) => `/api/customers/${encodeURIComponent(String(params.id))}`,
    beforePath: (params) => `/api/customers/${encodeURIComponent(String(params.id))}`,
    cascade: async (kimai, params) => {
      const id = String(params.id);
      const projects = await collectChildren(kimai, "/api/projects", { customers: [id], visible: 3 });
      const timesheets = await collectAffectedTimesheets(kimai, "customers", id);
      return { projects, ...timesheets };
    },
    heading: "Kimai Customer Deleted"
  });
}

// ----------------------------------------------------------------- projects

function registerProjectTools(server: McpServer, client: KimaiClient): void {
  registerWriteTool(server, client, {
    name: "kimai_create_project",
    title: "Create Kimai Project",
    description:
      "Create a Kimai project via POST /api/projects. Sensitive edit: call only after explicit human authorization. Kimai requires name and customer. The request and created record are saved to a temp backup file.",
    inputSchema: ProjectCreateSchema.shape,
    method: "POST",
    path: () => "/api/projects",
    body: (params) => buildPayload(params, CONTROL_KEYS),
    preferredFields: PROJECT_FIELDS,
    heading: "Kimai Project Created"
  });

  registerWriteTool(server, client, {
    name: "kimai_update_project",
    title: "Update Kimai Project",
    description:
      "Update a Kimai project via PATCH /api/projects/<id>. Sensitive edit: call only after explicit human authorization. Prefer visible: false over deleting a project. The prior record is saved to a temp backup file.",
    inputSchema: ProjectUpdateSchema.shape,
    method: "PATCH",
    path: (params) => `/api/projects/${encodeURIComponent(String(params.id))}`,
    beforePath: (params) => `/api/projects/${encodeURIComponent(String(params.id))}`,
    body: (params) => buildPayload(params, CONTROL_KEYS),
    preferredFields: PROJECT_FIELDS,
    heading: "Kimai Project Updated"
  });

  registerDeleteTool(server, client, {
    name: "kimai_delete_project",
    title: "Delete Kimai Project",
    description:
      "Delete a Kimai project via DELETE /api/projects/<id>. IRREVERSIBLE AND CASCADING: Kimai also deletes the project's activities and every timesheet booked against it. Requires KIMAI_ALLOW_DELETE=true plus explicit human authorization. Consider kimai_update_project with visible: false instead. The project, its activities, and all affected timesheets are saved to a temp backup file first.",
    inputSchema: DeleteEntitySchema.shape,
    path: (params) => `/api/projects/${encodeURIComponent(String(params.id))}`,
    beforePath: (params) => `/api/projects/${encodeURIComponent(String(params.id))}`,
    cascade: async (kimai, params) => {
      const id = String(params.id);
      const activities = await collectChildren(kimai, "/api/activities", { projects: [id], visible: 3 });
      const timesheets = await collectAffectedTimesheets(kimai, "projects", id);
      return { activities, ...timesheets };
    },
    heading: "Kimai Project Deleted"
  });
}

// --------------------------------------------------------------- activities

function registerActivityTools(server: McpServer, client: KimaiClient): void {
  registerWriteTool(server, client, {
    name: "kimai_create_activity",
    title: "Create Kimai Activity",
    description:
      "Create a Kimai activity via POST /api/activities. Sensitive edit: call only after explicit human authorization. Omit project to create a global activity usable by every project. The request and created record are saved to a temp backup file.",
    inputSchema: ActivityCreateSchema.shape,
    method: "POST",
    path: () => "/api/activities",
    body: (params) => buildPayload(params, CONTROL_KEYS),
    preferredFields: ACTIVITY_FIELDS,
    heading: "Kimai Activity Created"
  });

  registerWriteTool(server, client, {
    name: "kimai_update_activity",
    title: "Update Kimai Activity",
    description:
      "Update a Kimai activity via PATCH /api/activities/<id>. Sensitive edit: call only after explicit human authorization. Prefer visible: false over deleting an activity. The prior record is saved to a temp backup file.",
    inputSchema: ActivityUpdateSchema.shape,
    method: "PATCH",
    path: (params) => `/api/activities/${encodeURIComponent(String(params.id))}`,
    beforePath: (params) => `/api/activities/${encodeURIComponent(String(params.id))}`,
    body: (params) => buildPayload(params, CONTROL_KEYS),
    preferredFields: ACTIVITY_FIELDS,
    heading: "Kimai Activity Updated"
  });

  registerDeleteTool(server, client, {
    name: "kimai_delete_activity",
    title: "Delete Kimai Activity",
    description:
      "Delete a Kimai activity via DELETE /api/activities/<id>. IRREVERSIBLE AND CASCADING: every timesheet booked against the activity is deleted with it. Requires KIMAI_ALLOW_DELETE=true plus explicit human authorization. Consider kimai_update_activity with visible: false instead. The activity and all affected timesheets are saved to a temp backup file first.",
    inputSchema: DeleteEntitySchema.shape,
    path: (params) => `/api/activities/${encodeURIComponent(String(params.id))}`,
    beforePath: (params) => `/api/activities/${encodeURIComponent(String(params.id))}`,
    cascade: async (kimai, params) => collectAffectedTimesheets(kimai, "activities", String(params.id)),
    heading: "Kimai Activity Deleted"
  });
}

// -------------------------------------------------------------------- teams

function registerTeamTools(server: McpServer, client: KimaiClient): void {
  registerWriteTool(server, client, {
    name: "kimai_create_team",
    title: "Create Kimai Team",
    description:
      "Create a Kimai team via POST /api/teams. Sensitive edit: call only after explicit human authorization. Kimai requires a name and at least one member, one of whom must be a teamlead. The request and created record are saved to a temp backup file.",
    inputSchema: TeamCreateSchema.shape,
    method: "POST",
    path: () => "/api/teams",
    body: (params) => buildPayload(params, CONTROL_KEYS, []),
    preferredFields: TEAM_FIELDS,
    heading: "Kimai Team Created"
  });

  registerWriteTool(server, client, {
    name: "kimai_update_team",
    title: "Update Kimai Team",
    description:
      "Update a Kimai team via PATCH /api/teams/<id>. Sensitive edit: call only after explicit human authorization. Supplying members replaces the whole member list. The prior record is saved to a temp backup file.",
    inputSchema: TeamUpdateSchema.shape,
    method: "PATCH",
    path: (params) => `/api/teams/${encodeURIComponent(String(params.id))}`,
    beforePath: (params) => `/api/teams/${encodeURIComponent(String(params.id))}`,
    body: (params) => buildPayload(params, CONTROL_KEYS, []),
    preferredFields: TEAM_FIELDS,
    heading: "Kimai Team Updated"
  });

  registerDeleteTool(server, client, {
    name: "kimai_delete_team",
    title: "Delete Kimai Team",
    description:
      "Delete a Kimai team via DELETE /api/teams/<id>. Irreversible. Removes the team and the access it granted, but does not delete users, customers, projects, or timesheets. Requires KIMAI_ALLOW_DELETE=true plus explicit human authorization. The team is saved to a temp backup file first.",
    inputSchema: DeleteEntitySchema.shape,
    path: (params) => `/api/teams/${encodeURIComponent(String(params.id))}`,
    beforePath: (params) => `/api/teams/${encodeURIComponent(String(params.id))}`,
    heading: "Kimai Team Deleted"
  });
}

// --------------------------------------------------------------------- tags

function registerTagTools(server: McpServer, client: KimaiClient): void {
  registerWriteTool(server, client, {
    name: "kimai_create_tag",
    title: "Create Kimai Tag",
    description:
      "Create a Kimai tag via POST /api/tags. Sensitive edit: call only after explicit human authorization. The request and created record are saved to a temp backup file.",
    inputSchema: TagCreateSchema.shape,
    method: "POST",
    path: () => "/api/tags",
    body: (params) => buildPayload(params, CONTROL_KEYS),
    preferredFields: ["id", "name", "visible", "color"],
    heading: "Kimai Tag Created"
  });

  registerDeleteTool(server, client, {
    name: "kimai_delete_tag",
    title: "Delete Kimai Tag",
    description:
      "Delete a Kimai tag via DELETE /api/tags/<id>. Irreversible. The tag is removed from every timesheet that carries it; the timesheets themselves are kept. Requires KIMAI_ALLOW_DELETE=true plus explicit human authorization.",
    inputSchema: DeleteEntitySchema.shape,
    path: (params) => `/api/tags/${encodeURIComponent(String(params.id))}`,
    heading: "Kimai Tag Deleted"
  });
}

// -------------------------------------------------------------------- users

function registerUserWriteTools(server: McpServer, client: KimaiClient): void {
  registerWriteTool(server, client, {
    name: "kimai_create_user",
    title: "Create Kimai User",
    description:
      "Create a Kimai user via POST /api/users. Sensitive edit: call only after explicit human authorization. Kimai requires username, email, password, language, and timezone. The plain password is written to the temp backup file along with the rest of the request, so treat that file as a secret.",
    inputSchema: UserCreateSchema.shape,
    method: "POST",
    path: () => "/api/users",
    body: (params) => buildPayload(params, CONTROL_KEYS, []),
    preferredFields: USER_FIELDS,
    heading: "Kimai User Created"
  });

  registerWriteTool(server, client, {
    name: "kimai_update_user",
    title: "Update Kimai User",
    description:
      "Update a Kimai user via PATCH /api/users/<id>. Sensitive edit: call only after explicit human authorization. Supplying roles replaces the whole role list; set enabled: false to deactivate an account. The prior record is saved to a temp backup file.",
    inputSchema: UserUpdateSchema.shape,
    method: "PATCH",
    path: (params) => `/api/users/${encodeURIComponent(String(params.id))}`,
    beforePath: (params) => `/api/users/${encodeURIComponent(String(params.id))}`,
    body: (params) => buildPayload(params, CONTROL_KEYS, []),
    preferredFields: USER_FIELDS,
    heading: "Kimai User Updated"
  });

  // Kimai reads this body with $request->request->all(), so it must be a bare
  // JSON array of {name, value} rather than an object.
  registerWriteTool(server, client, {
    name: "kimai_update_user_preferences",
    title: "Update Kimai User Preferences",
    description:
      "Set configured Kimai user preferences via PATCH /api/users/<id>/preferences, for example hourly_rate or internal_rate. Sensitive edit: call only after explicit human authorization. Only preferences that already exist can be set; unknown names are rejected. The prior user record is saved to a temp backup file.",
    inputSchema: UserPreferencesSchema.shape,
    method: "PATCH",
    path: (params) => `/api/users/${encodeURIComponent(String(params.id))}/preferences`,
    beforePath: (params) => `/api/users/${encodeURIComponent(String(params.id))}`,
    body: (params) => params.preferences as unknown[],
    preferredFields: [...USER_FIELDS, "preferences"],
    heading: "Kimai User Preferences Updated"
  });

  registerDeleteTool(server, client, {
    name: "kimai_delete_api_token",
    title: "Delete Kimai API Token",
    description:
      "Revoke a Kimai API token via DELETE /api/users/api-token/<id>. Irreversible. Kimai only allows this for tokens belonging to the authenticated user. Deleting the token this MCP server is configured with will break every other tool here. Requires KIMAI_ALLOW_DELETE=true plus explicit human authorization.",
    inputSchema: DeleteEntitySchema.shape,
    path: (params) => `/api/users/api-token/${encodeURIComponent(String(params.id))}`,
    heading: "Kimai API Token Deleted"
  });
}
