import { z } from "zod";
import {
  DateTimeSchema,
  EntityStateSchema,
  IdSchema,
  OrderSchema,
  PageSchema,
  ResponseFormatSchema,
  SizeSchema
} from "./common.js";

/**
 * Read schemas, one per Kimai collection.
 *
 * Kimai declares its query parameters per endpoint and validates them strictly,
 * so these schemas deliberately do NOT share one permissive shape: a parameter
 * that is valid on /api/timesheets is a 400 or a silent no-op elsewhere. Every
 * `order_by` enum below mirrors that endpoint's own `requirements` regex.
 */

const IdListSchema = z
  .array(IdSchema)
  .optional()
  .describe("Optional list of IDs. Sent to Kimai as name[]=1&name[]=2.");

export const CollectionSchema = z
  .object({
    page: PageSchema,
    size: SizeSchema,
    response_format: ResponseFormatSchema
  })
  .strict();

/** For Kimai endpoints that accept no query parameters at all. */
export const UnpaginatedCollectionSchema = z
  .object({
    response_format: ResponseFormatSchema
  })
  .strict();

export const EntityIdSchema = z
  .object({
    id: IdSchema,
    response_format: ResponseFormatSchema
  })
  .strict();

export const SearchableCollectionSchema = CollectionSchema.extend({
  term: z.string().min(1).optional().describe("Optional free-text search term."),
  order_by: z.string().min(1).optional().describe("Optional Kimai orderBy field."),
  order: OrderSchema
}).strict();

export const CustomerCollectionSchema = CollectionSchema.extend({
  term: z.string().min(1).optional().describe("Optional free-text search term."),
  order_by: z.enum(["id", "name"]).optional().describe("Optional sort field. Kimai allows id or name."),
  order: OrderSchema,
  visible: EntityStateSchema,
  full: z.boolean().optional().describe("Fetch fully serialized customers including subresources.")
}).strict();

export const ProjectCollectionSchema = CollectionSchema.extend({
  term: z.string().min(1).optional().describe("Optional free-text search term."),
  order_by: z.enum(["id", "name", "customer"]).optional().describe("Optional sort field. Kimai allows id, name, or customer."),
  order: OrderSchema,
  visible: EntityStateSchema,
  customer: IdSchema.optional().describe("Optional single customer ID filter."),
  customers: IdListSchema.describe("Optional list of customer IDs to filter by."),
  start: DateTimeSchema.describe("Only projects running at or after this date-time (HTML5 local date-time)."),
  end: DateTimeSchema.describe("Only projects running at or before this date-time (HTML5 local date-time)."),
  ignore_dates: z.boolean().optional().describe("Ignore the project start/end dates when filtering."),
  global_activities: z.boolean().optional().describe("Filter projects by whether they allow global activities.")
}).strict();

export const ActivityCollectionSchema = CollectionSchema.extend({
  term: z.string().min(1).optional().describe("Optional free-text search term."),
  order_by: z.enum(["id", "name", "project"]).optional().describe("Optional sort field. Kimai allows id, name, or project."),
  order: OrderSchema,
  visible: EntityStateSchema,
  project: IdSchema.optional().describe("Optional single project ID filter."),
  projects: IdListSchema.describe("Optional list of project IDs to filter by."),
  globals: z.boolean().optional().describe("Return only global activities (those with no project).")
}).strict();

export const UserCollectionSchema = CollectionSchema.extend({
  term: z.string().min(1).optional().describe("Optional free-text search term."),
  order_by: z
    .enum(["id", "username", "alias", "email"])
    .optional()
    .describe("Optional sort field. Kimai allows id, username, alias, or email."),
  order: OrderSchema,
  visible: EntityStateSchema.describe("Optional filter for enabled/disabled users."),
  full: z.boolean().optional().describe("Fetch fully serialized users including preferences and teams.")
}).strict();

export const TimesheetCollectionSchema = CollectionSchema.extend({
  user: IdSchema.optional().describe(
    'Single user ID, or the literal string "all" for every user. Defaults to the API token owner ONLY, so a report that should cover the whole team must pass user: "all" (requires the view_other_timesheet permission). Omitting this is the most common cause of an undercounted total.'
  ),
  users: IdListSchema.describe('Optional list of user IDs. Ignored by Kimai when user is "all".'),
  customer: IdSchema.optional().describe("Optional single customer ID filter."),
  customers: IdListSchema.describe("Optional list of customer IDs to filter by."),
  project: IdSchema.optional().describe("Optional single project ID filter."),
  projects: IdListSchema.describe("Optional list of project IDs to filter by."),
  activity: IdSchema.optional().describe("Optional single activity ID filter."),
  activities: IdListSchema.describe("Optional list of activity IDs to filter by."),
  begin: DateTimeSchema.describe("Only records started at or after this date-time (HTML5 local date-time)."),
  end: DateTimeSchema.describe("Only records started at or before this date-time (HTML5 local date-time)."),
  modified_after: DateTimeSchema.describe(
    "Only records changed after this date-time. Kimai stores this field in UTC, so pass a UTC date-time."
  ),
  exported: z.boolean().optional().describe("Filter by export state: true = exported, false = not exported."),
  active: z.boolean().optional().describe("Filter by running state: true = running, false = stopped."),
  billable: z.boolean().optional().describe("Filter by billable state: true = billable, false = non-billable."),
  full: z.boolean().optional().describe("Fetch fully serialized records including customer, project, and user objects."),
  term: z.string().min(1).optional().describe("Optional free-text search term."),
  order_by: z
    .enum(["id", "begin", "end", "rate"])
    .optional()
    .describe("Optional sort field. Kimai allows id, begin, end, or rate."),
  order: OrderSchema,
  tags: z
    .array(z.string().min(1))
    .optional()
    .describe(
      "Optional tag names, sent to Kimai as tags[]=a&tags[]=b. Kimai answers HTTP 400 rather than an empty result when a tag name does not exist, so confirm spelling with kimai_list_tags first."
    )
}).strict();

/** /api/timesheets/recent accepts only begin and size, never page. */
export const RecentTimesheetSchema = z
  .object({
    begin: DateTimeSchema.describe("Only records started at or after this date-time. Kimai defaults to one year ago."),
    size: SizeSchema.describe("Number of entries to return. Kimai defaults to 10."),
    response_format: ResponseFormatSchema
  })
  .strict();

export const InvoiceCollectionSchema = CollectionSchema.extend({
  begin: DateTimeSchema.describe("Only invoices created at or after this date-time (HTML5 local date-time)."),
  end: DateTimeSchema.describe("Only invoices created at or before this date-time (HTML5 local date-time)."),
  customers: IdListSchema.describe("Optional list of customer IDs to filter by."),
  status: z
    .array(z.enum(["pending", "paid", "canceled", "new"]))
    .optional()
    .describe("Optional invoice statuses. Sent to Kimai as status[]=paid&status[]=new.")
}).strict();

/** /api/tags/find only filters when a name is supplied; see the tags tool. */
export const TagCollectionSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .optional()
      .describe("Optional tag name search. When omitted, the tool lists every tag name instead."),
    response_format: ResponseFormatSchema
  })
  .strict();

export const AbsenceCollectionSchema = z
  .object({
    user: IdSchema.optional().describe("Optional user ID filter."),
    begin: DateTimeSchema.describe("Optional range start (HTML5 local date-time)."),
    end: DateTimeSchema.describe("Optional range end (HTML5 local date-time)."),
    response_format: ResponseFormatSchema
  })
  .strict();

export type CollectionInput = z.infer<typeof CollectionSchema>;
export type EntityIdInput = z.infer<typeof EntityIdSchema>;
export type SearchableCollectionInput = z.infer<typeof SearchableCollectionSchema>;
export type CustomerCollectionInput = z.infer<typeof CustomerCollectionSchema>;
export type ProjectCollectionInput = z.infer<typeof ProjectCollectionSchema>;
export type ActivityCollectionInput = z.infer<typeof ActivityCollectionSchema>;
export type UserCollectionInput = z.infer<typeof UserCollectionSchema>;
export type TimesheetCollectionInput = z.infer<typeof TimesheetCollectionSchema>;
export type RecentTimesheetInput = z.infer<typeof RecentTimesheetSchema>;
export type InvoiceCollectionInput = z.infer<typeof InvoiceCollectionSchema>;
export type TagCollectionInput = z.infer<typeof TagCollectionSchema>;
export type AbsenceCollectionInput = z.infer<typeof AbsenceCollectionSchema>;
