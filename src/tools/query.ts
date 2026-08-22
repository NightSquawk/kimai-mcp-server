/**
 * Query-string helpers shared by the read tools.
 *
 * Kimai validates query parameters with FOSRestBundle
 * `#[Rest\QueryParam(strict: true)]` attributes, so a value that does not match
 * the declared `requirements` regex is rejected with HTTP 400 instead of being
 * coerced. Three Kimai conventions break a naive pass-through, and each one was
 * verified against a live 2.65.0 instance before this file was written:
 *
 * 1. Boolean-ish filters (`exported`, `active`, `billable`, `full`,
 *    `globalActivities`, `globals`) declare `requirements: '0|1'`. A JS boolean
 *    serializes to `exported=true`, which fails validation:
 *      exported=true -> 400,  exported=1 -> 200
 *    This is the same defect class as the `visible` enum fixed in 0.1.1.
 *
 * 2. Visibility declares `requirements: '1|2|3'`, never the words.
 *
 * 3. Repeatable filters (`tags`, `users`, `customers`, `projects`,
 *    `activities`, `status`) are declared `map: true` and must be sent as
 *    `name[]=a&name[]=b`. A comma-joined scalar is NOT rejected: Kimai ignores
 *    it and returns UNFILTERED rows. Measured on a 200-row window:
 *      tags=nonexistent   -> 200 rows (filter silently dropped)
 *      tags[]=nonexistent ->   2 rows (filter applied)
 *    Silently wrong billing totals are worse than an error, so these values
 *    must stay arrays all the way down to axios, whose default serializer
 *    already emits the `name[]=` form.
 */

/** Map a boolean-ish filter onto Kimai's `0|1` requirement. */
export function flag(value: unknown): 0 | 1 | undefined {
  if (value === undefined || value === null) return undefined;
  return value ? 1 : 0;
}

/** Kimai expects the visibility filter as an integer; the words return 400. */
const VISIBILITY_QUERY: Record<string, number> = {
  visible: 1,
  hidden: 2,
  all: 3
};

export function visibility(value: unknown): number | undefined {
  if (typeof value === "string") return VISIBILITY_QUERY[value];
  if (typeof value === "number") return value;
  return undefined;
}

/**
 * Normalize a repeatable filter. Returns an array (so axios emits `name[]=`)
 * or undefined so `pruneUndefined` drops the key entirely.
 */
export function list(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  return value.map((entry) => String(entry));
}
