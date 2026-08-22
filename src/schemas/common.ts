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

export const OrderSchema = z.enum(["ASC", "DESC"]).optional().describe("Optional sort direction.");

/**
 * Per-call authorization required by every write and delete tool.
 *
 * This is a guardrail aimed at the model, not a security boundary: the process
 * already holds a real Kimai token. It exists so a write cannot happen as an
 * incidental side effect of a read-shaped request, and so the reason for the
 * edit is captured in the backup file next to the payload.
 */
export const AuthorizationSchema = {
  authorization_confirmed: z
    .literal(true)
    .describe("Must be true only after the human user explicitly authorizes this sensitive Kimai edit."),
  authorization_note: z
    .string()
    .min(8)
    .describe("Short note capturing the user's explicit authorization and reason for the edit.")
};

/**
 * Escape hatch for Kimai fields this server does not model explicitly.
 *
 * The Kimai edit forms carry a long tail of rarely used fields (buyerReference,
 * addressLine3, invoiceTemplate, metaFields, and so on) that change between
 * releases and plugin sets. Typing every one of them would guarantee drift, so
 * the common fields are typed and anything else is passed through verbatim.
 * Unknown keys are rejected by Symfony with HTTP 400, which surfaces as a
 * normal Kimai error rather than silent data loss.
 */
export const ExtraFieldsSchema = z
  .record(z.unknown())
  .optional()
  .describe(
    "Optional passthrough for Kimai fields this tool does not model explicitly, sent verbatim in the request body. Unknown field names are rejected by Kimai with HTTP 400."
  );
