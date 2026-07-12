import { z } from "zod";

export const ResponseFormatSchema = z
  .enum(["markdown", "json"])
  .default("markdown")
  .describe("Output format: markdown for human-readable summaries, json for structured output.");

export const PageSchema = z
  .number()
  .int()
  .min(1)
  .default(1)
  .describe("Kimai API page number for paginated endpoints.");

export const SizeSchema = z
  .number()
  .int()
  .min(1)
  .max(500)
  .default(50)
  .describe("Kimai API page size. Kimai supports a maximum size of 500.");

export const IdSchema = z.union([z.number().int().positive(), z.string().min(1)]).describe("Kimai entity ID.");

export const DateTimeSchema = z
  .string()
  .min(1)
  .optional()
  .describe("Optional date/time filter. Kimai returns ISO 8601; write endpoints use HTML5 local date-time.");

export const EntityStateSchema = z
  .enum(["all", "visible", "hidden"])
  .optional()
  .describe("Optional visibility filter for endpoints that support it.");
