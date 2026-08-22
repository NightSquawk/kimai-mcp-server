import { z } from "zod";
import { AuthorizationSchema, ExtraFieldsSchema, IdSchema, ResponseFormatSchema } from "./common.js";

/**
 * Create, update, and delete schemas for the Kimai master data entities.
 *
 * Field names mirror Kimai's own edit forms (src/Form/*EditForm.php in the
 * upstream release), converted to snake_case for the tool surface. Only the
 * fields Kimai marks required are required here; the long tail stays optional
 * and anything unmodeled goes through `extra_fields`.
 *
 * `visible` and `billable` are plain booleans in a request BODY. That is not
 * the same as the `visible` QUERY filter, which Kimai declares as 1|2|3. The
 * two must not be conflated.
 */

/** Budget fields shared by customers, projects, and activities. */
const BudgetFields = {
  budget: z.number().optional().describe("Money budget for the entity."),
  time_budget: z.number().int().optional().describe("Time budget in seconds."),
  budget_type: z
    .string()
    .optional()
    .describe('Budget reset interval. Kimai uses "month" for a recurring monthly budget; omit for a total budget.')
};

/** Visibility fields shared by customers, projects, and activities. */
const StateFields = {
  visible: z.boolean().optional().describe("Whether the entity is visible in Kimai."),
  billable: z.boolean().optional().describe("Whether time booked on this entity is billable by default.")
};

const WriteEnvelope = {
  ...AuthorizationSchema,
  extra_fields: ExtraFieldsSchema,
  response_format: ResponseFormatSchema
};

/** Delete envelope: an ID plus the standard authorization fields. */
export const DeleteEntitySchema = z
  .object({
    ...AuthorizationSchema,
    id: IdSchema,
    response_format: ResponseFormatSchema
  })
  .strict();

export type DeleteEntityInput = z.infer<typeof DeleteEntitySchema>;

// ---------------------------------------------------------------- customers

const CustomerFields = {
  name: z.string().min(1).describe("Customer name."),
  number: z.string().optional().describe("Customer number."),
  comment: z.string().optional().describe("Free-text comment."),
  company: z.string().optional().describe("Company name."),
  vat_id: z.string().optional().describe("VAT identification number."),
  contact: z.string().optional().describe("Primary contact name."),
  address: z.string().optional().describe("Postal address."),
  post_code: z.string().optional().describe("Postal code."),
  city: z.string().optional().describe("City."),
  country: z.string().length(2).optional().describe("Two-letter ISO country code, for example US."),
  currency: z.string().length(3).optional().describe("Three-letter ISO currency code, for example USD."),
  timezone: z.string().optional().describe("Timezone identifier, for example America/Los_Angeles."),
  language: z.string().optional().describe("Language code, for example en."),
  phone: z.string().optional().describe("Phone number."),
  mobile: z.string().optional().describe("Mobile number."),
  fax: z.string().optional().describe("Fax number."),
  email: z.string().optional().describe("Contact email address."),
  homepage: z.string().optional().describe("Website URL."),
  invoice_text: z.string().optional().describe("Text placed on invoices for this customer."),
  invoice_email: z.string().optional().describe("Email address invoices are sent to."),
  ...BudgetFields,
  ...StateFields
};

export const CustomerCreateSchema = z
  .object({
    ...WriteEnvelope,
    ...CustomerFields,
    country: z.string().length(2).describe("Two-letter ISO country code, for example US. Required by Kimai."),
    currency: z.string().length(3).describe("Three-letter ISO currency code, for example USD. Required by Kimai."),
    timezone: z.string().min(1).describe("Timezone identifier, for example America/Los_Angeles. Required by Kimai.")
  })
  .strict();

export const CustomerUpdateSchema = z
  .object({
    ...WriteEnvelope,
    id: IdSchema,
    ...CustomerFields,
    name: CustomerFields.name.optional()
  })
  .strict();

// ----------------------------------------------------------------- projects

const ProjectFields = {
  name: z.string().min(1).describe("Project name."),
  number: z.string().optional().describe("Project number."),
  comment: z.string().optional().describe("Free-text comment."),
  order_number: z.string().optional().describe("Customer order number."),
  order_date: z.string().optional().describe("Order date in HTML5 local date-time format."),
  start: z.string().optional().describe("Project start in HTML5 local date-time format."),
  end: z.string().optional().describe("Project end in HTML5 local date-time format."),
  invoice_text: z.string().optional().describe("Text placed on invoices for this project."),
  global_activities: z.boolean().optional().describe("Whether global activities can be booked on this project."),
  ...BudgetFields,
  ...StateFields
};

export const ProjectCreateSchema = z
  .object({
    ...WriteEnvelope,
    ...ProjectFields,
    customer: IdSchema.describe("Owning customer ID. Required by Kimai.")
  })
  .strict();

export const ProjectUpdateSchema = z
  .object({
    ...WriteEnvelope,
    id: IdSchema,
    ...ProjectFields,
    name: ProjectFields.name.optional(),
    customer: IdSchema.optional().describe("Move the project to a different customer.")
  })
  .strict();

// --------------------------------------------------------------- activities

const ActivityFields = {
  name: z.string().min(1).describe("Activity name."),
  number: z.string().optional().describe("Activity number."),
  comment: z.string().optional().describe("Free-text comment."),
  invoice_text: z.string().optional().describe("Text placed on invoices for this activity."),
  ...BudgetFields,
  ...StateFields
};

export const ActivityCreateSchema = z
  .object({
    ...WriteEnvelope,
    ...ActivityFields,
    project: IdSchema.optional().describe("Owning project ID. Omit to create a global activity.")
  })
  .strict();

export const ActivityUpdateSchema = z
  .object({
    ...WriteEnvelope,
    id: IdSchema,
    ...ActivityFields,
    name: ActivityFields.name.optional(),
    project: IdSchema.optional().describe("Move the activity to a different project.")
  })
  .strict();

// -------------------------------------------------------------------- teams

const TeamMemberSchema = z
  .object({
    user: IdSchema.describe("User ID."),
    teamlead: z.boolean().default(false).describe("Whether this member leads the team.")
  })
  .strict();

export const TeamCreateSchema = z
  .object({
    ...WriteEnvelope,
    name: z.string().min(1).describe("Team name."),
    members: z
      .array(TeamMemberSchema)
      .min(1)
      .describe("Team members. Kimai requires at least one, and at least one teamlead.")
  })
  .strict();

export const TeamUpdateSchema = z
  .object({
    ...WriteEnvelope,
    id: IdSchema,
    name: z.string().min(1).optional().describe("Team name."),
    members: z.array(TeamMemberSchema).optional().describe("Replacement member list.")
  })
  .strict();

/** Teams own four kinds of assignment, all with identical POST/DELETE shapes. */
export const TeamAssignmentSchema = z
  .object({
    ...AuthorizationSchema,
    id: IdSchema.describe("Team ID."),
    kind: z
      .enum(["member", "customer", "project", "activity"])
      .describe("What is being granted to or revoked from the team."),
    target_id: IdSchema.describe("ID of the user, customer, project, or activity named by `kind`."),
    response_format: ResponseFormatSchema
  })
  .strict();

export type TeamAssignmentInput = z.infer<typeof TeamAssignmentSchema>;

/*
 * Removed on purpose: POST /api/customers|projects|activities/{id}/team exists
 * in the route table but Kimai 2.65.0 answers it with 410 Gone
 * ("this endpoint was removed, use POST /api/teams/ instead"). Team access is
 * granted from the team side via kimai_add_team_assignment.
 */

// --------------------------------------------------------------------- tags

export const TagCreateSchema = z
  .object({
    ...WriteEnvelope,
    name: z.string().min(1).describe("Tag name."),
    visible: z.boolean().optional().describe("Whether the tag is visible.")
  })
  .strict();

// -------------------------------------------------------------------- users

const UserFields = {
  alias: z.string().optional().describe("Display name."),
  title: z.string().optional().describe("Job title."),
  account_number: z.string().optional().describe("Account number."),
  language: z.string().optional().describe("Language code, for example en."),
  locale: z.string().optional().describe("Locale code, for example en."),
  timezone: z.string().optional().describe("Timezone identifier, for example America/Los_Angeles."),
  enabled: z.boolean().optional().describe("Whether the account can sign in."),
  system_account: z.boolean().optional().describe("Whether this is a system account."),
  requires_password_reset: z.boolean().optional().describe("Force a password change at next sign-in."),
  roles: z
    .array(z.string().min(1))
    .optional()
    .describe("Kimai roles, for example ROLE_USER, ROLE_TEAMLEAD, ROLE_ADMIN. Sent as a JSON array, not a joined string.")
};

export const UserCreateSchema = z
  .object({
    ...WriteEnvelope,
    username: z.string().min(1).describe("Login username."),
    email: z.string().min(1).describe("Email address. Required by Kimai."),
    plain_password: z.string().min(8).describe("Plain text password. Required by Kimai on create."),
    plain_api_token: z.string().optional().describe("Optional plain API token to assign at creation."),
    ...UserFields,
    language: z.string().min(1).describe("Language code, for example en. Required by Kimai."),
    timezone: z.string().min(1).describe("Timezone identifier, for example America/Los_Angeles. Required by Kimai.")
  })
  .strict();

export const UserUpdateSchema = z
  .object({
    ...WriteEnvelope,
    id: IdSchema,
    username: z.string().min(1).optional().describe("Login username."),
    email: z.string().min(1).optional().describe("Email address."),
    ...UserFields
  })
  .strict();

export const UserPreferencesSchema = z
  .object({
    ...AuthorizationSchema,
    id: IdSchema.describe("User ID."),
    preferences: z
      .array(z.object({ name: z.string().min(1), value: z.string() }).strict())
      .min(1)
      .describe("Preferences to set, for example [{ name: \"hourly_rate\", value: \"125\" }]."),
    response_format: ResponseFormatSchema
  })
  .strict();

export type UserPreferencesInput = z.infer<typeof UserPreferencesSchema>;

// -------------------------------------------------------- rates & comments

const RateEntitySchema = z
  .enum(["customer", "project", "activity"])
  .describe("Which Kimai entity the rate belongs to.");

export const RateListSchema = z
  .object({
    entity: RateEntitySchema,
    id: IdSchema.describe("Entity ID."),
    response_format: ResponseFormatSchema
  })
  .strict();

export const RateCreateSchema = z
  .object({
    ...AuthorizationSchema,
    entity: RateEntitySchema,
    id: IdSchema.describe("Entity ID."),
    rate: z.number().describe("Billable rate."),
    internal_rate: z.number().optional().describe("Internal cost rate."),
    is_fixed: z.boolean().optional().describe("Whether the rate is a fixed amount rather than hourly."),
    user: IdSchema.optional().describe("Restrict the rate to one user. Omit for a rate that applies to everyone."),
    response_format: ResponseFormatSchema
  })
  .strict();

export const RateDeleteSchema = z
  .object({
    ...AuthorizationSchema,
    entity: RateEntitySchema,
    id: IdSchema.describe("Entity ID."),
    rate_id: IdSchema.describe("Rate ID to delete."),
    response_format: ResponseFormatSchema
  })
  .strict();

export type RateListInput = z.infer<typeof RateListSchema>;
export type RateCreateInput = z.infer<typeof RateCreateSchema>;
export type RateDeleteInput = z.infer<typeof RateDeleteSchema>;

/** Only customers and projects carry comments; activities do not. */
const CommentEntitySchema = z.enum(["customer", "project"]).describe("Which Kimai entity the comment belongs to.");

export const CommentListSchema = z
  .object({
    entity: CommentEntitySchema,
    id: IdSchema.describe("Entity ID."),
    response_format: ResponseFormatSchema
  })
  .strict();

export const CommentCreateSchema = z
  .object({
    ...AuthorizationSchema,
    entity: CommentEntitySchema,
    id: IdSchema.describe("Entity ID."),
    message: z.string().min(1).describe("Comment body. Markdown is supported."),
    pinned: z.boolean().optional().describe("Pinned comments always appear first."),
    response_format: ResponseFormatSchema
  })
  .strict();

export const CommentActionSchema = z
  .object({
    ...AuthorizationSchema,
    entity: CommentEntitySchema,
    id: IdSchema.describe("Entity ID."),
    comment_id: IdSchema.describe("Comment ID."),
    response_format: ResponseFormatSchema
  })
  .strict();

export type CommentListInput = z.infer<typeof CommentListSchema>;
export type CommentCreateInput = z.infer<typeof CommentCreateSchema>;
export type CommentActionInput = z.infer<typeof CommentActionSchema>;

// --------------------------------------------------------------- meta fields

export const MetaUpdateSchema = z
  .object({
    ...AuthorizationSchema,
    entity: z
      .enum(["customer", "project", "activity", "timesheet"])
      .describe("Which Kimai entity owns the meta field."),
    id: IdSchema.describe("Entity ID."),
    name: z.string().min(1).describe("Meta field name as configured in Kimai."),
    value: z.string().describe("Meta field value."),
    response_format: ResponseFormatSchema
  })
  .strict();

export type MetaUpdateInput = z.infer<typeof MetaUpdateSchema>;

// ------------------------------------------------------------------ invoices

export const InvoiceCustomFieldsSchema = z
  .object({
    ...AuthorizationSchema,
    id: IdSchema.describe("Invoice ID."),
    fields: z
      .array(z.object({ name: z.string().min(1), value: z.string() }).strict())
      .min(1)
      .describe("Custom fields to set on the invoice."),
    response_format: ResponseFormatSchema
  })
  .strict();

export type InvoiceCustomFieldsInput = z.infer<typeof InvoiceCustomFieldsSchema>;
