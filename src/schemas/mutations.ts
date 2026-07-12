import { z } from "zod";
import { DateTimeSchema, IdSchema, ResponseFormatSchema } from "./common.js";

const AuthorizationSchema = {
  authorization_confirmed: z
    .literal(true)
    .describe("Must be true only after the human user explicitly authorizes this sensitive Kimai edit."),
  authorization_note: z
    .string()
    .min(8)
    .describe("Short note capturing the user's explicit authorization and reason for the edit.")
};

const TimesheetEditableFields = {
  begin: DateTimeSchema.describe("Timesheet begin timestamp in Kimai HTML5 datetime-local format, e.g. 2026-06-01T09:00:00."),
  end: DateTimeSchema.describe("Optional timesheet end timestamp in Kimai HTML5 datetime-local format, e.g. 2026-06-01T10:30:00."),
  project: IdSchema.optional().describe("Kimai project ID."),
  activity: IdSchema.optional().describe("Kimai activity ID."),
  description: z.string().optional().describe("Optional timesheet description."),
  fixed_rate: z.number().optional().describe("Optional fixed rate override."),
  hourly_rate: z.number().optional().describe("Optional hourly rate override."),
  user: IdSchema.optional().describe("Optional user ID; requires permission to edit other users' time."),
  tags: z.array(z.string().min(1)).optional().describe("Optional tags; sent to Kimai as a comma-separated list."),
  exported: z.boolean().optional().describe("Optional exported flag. This can lock/unlock timesheet records."),
  billable: z.boolean().optional().describe("Optional billable flag.")
};

export const CreateTimesheetSchema = z
  .object({
    ...AuthorizationSchema,
    begin: z.string().min(1).describe("Timesheet begin timestamp in Kimai HTML5 datetime-local format, e.g. 2026-06-01T09:00:00."),
    project: IdSchema.describe("Kimai project ID."),
    activity: IdSchema.describe("Kimai activity ID."),
    end: TimesheetEditableFields.end,
    description: TimesheetEditableFields.description,
    fixed_rate: TimesheetEditableFields.fixed_rate,
    hourly_rate: TimesheetEditableFields.hourly_rate,
    user: TimesheetEditableFields.user,
    tags: TimesheetEditableFields.tags,
    exported: TimesheetEditableFields.exported,
    billable: TimesheetEditableFields.billable,
    full: z.boolean().default(true).describe("Request fully serialized Kimai response where supported."),
    response_format: ResponseFormatSchema
  })
  .strict();

export const UpdateTimesheetSchema = z
  .object({
    ...AuthorizationSchema,
    id: IdSchema,
    ...TimesheetEditableFields,
    response_format: ResponseFormatSchema
  })
  .strict();

export const TimesheetStateChangeSchema = z
  .object({
    ...AuthorizationSchema,
    id: IdSchema,
    begin: DateTimeSchema.describe("Optional restart begin timestamp in Kimai HTML5 datetime-local format."),
    response_format: ResponseFormatSchema
  })
  .strict();

export const DuplicateTimesheetSchema = z
  .object({
    ...AuthorizationSchema,
    id: IdSchema,
    response_format: ResponseFormatSchema
  })
  .strict();

export type CreateTimesheetInput = z.infer<typeof CreateTimesheetSchema>;
export type UpdateTimesheetInput = z.infer<typeof UpdateTimesheetSchema>;
export type TimesheetStateChangeInput = z.infer<typeof TimesheetStateChangeSchema>;
export type DuplicateTimesheetInput = z.infer<typeof DuplicateTimesheetSchema>;
