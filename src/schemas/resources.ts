import { z } from "zod";
import { DateTimeSchema, EntityStateSchema, IdSchema, PageSchema, ResponseFormatSchema, SizeSchema } from "./common.js";

export const CollectionSchema = z
  .object({
    page: PageSchema,
    size: SizeSchema,
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
  term: z.string().min(1).optional().describe("Optional search term for endpoints that support it."),
  order_by: z.string().min(1).optional().describe("Optional Kimai orderBy field."),
  order: z.enum(["ASC", "DESC"]).optional().describe("Optional sort direction.")
}).strict();

export const CustomerCollectionSchema = SearchableCollectionSchema.extend({
  visible: EntityStateSchema
}).strict();

export const ProjectCollectionSchema = SearchableCollectionSchema.extend({
  customer: IdSchema.optional().describe("Optional customer ID filter."),
  visible: EntityStateSchema
}).strict();

export const ActivityCollectionSchema = SearchableCollectionSchema.extend({
  project: IdSchema.optional().describe("Optional project ID filter."),
  visible: EntityStateSchema
}).strict();

export const TimesheetCollectionSchema = CollectionSchema.extend({
  user: IdSchema.optional().describe("Optional user ID filter."),
  customer: IdSchema.optional().describe("Optional customer ID filter."),
  project: IdSchema.optional().describe("Optional project ID filter."),
  activity: IdSchema.optional().describe("Optional activity ID filter."),
  begin: DateTimeSchema.describe("Optional begin date/time filter."),
  end: DateTimeSchema.describe("Optional end date/time filter."),
  exported: z.boolean().optional().describe("Optional exported-state filter."),
  active: z.boolean().optional().describe("Optional active/running filter."),
  tags: z.array(z.string().min(1)).optional().describe("Optional tag filters.")
}).strict();

export const TagCollectionSchema = CollectionSchema.extend({
  name: z.string().min(1).optional().describe("Optional tag name search.")
}).strict();

export type CollectionInput = z.infer<typeof CollectionSchema>;
export type EntityIdInput = z.infer<typeof EntityIdSchema>;
export type SearchableCollectionInput = z.infer<typeof SearchableCollectionSchema>;
export type CustomerCollectionInput = z.infer<typeof CustomerCollectionSchema>;
export type ProjectCollectionInput = z.infer<typeof ProjectCollectionSchema>;
export type ActivityCollectionInput = z.infer<typeof ActivityCollectionSchema>;
export type TimesheetCollectionInput = z.infer<typeof TimesheetCollectionSchema>;
export type TagCollectionInput = z.infer<typeof TagCollectionSchema>;
