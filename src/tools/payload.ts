/**
 * Request-body helpers shared by the write tools.
 *
 * Tool parameters are snake_case for consistency with the rest of this server;
 * Kimai's edit forms are camelCase (timeBudget, invoiceText, orderNumber,
 * globalActivities, vatId, plainPassword). One generic conversion covers every
 * field, so adding a tool never means adding a mapping entry.
 *
 * Note the asymmetry with query.ts on purpose: in a request BODY Kimai wants
 * tags as a comma-separated string, while in a query STRING it wants a
 * repeated `tags[]=` parameter. Do not unify these.
 *
 * Array handling is opt-in per field rather than blanket, because Kimai is not
 * consistent: `tags` must be comma-joined, but `roles` and `teams` must stay
 * JSON arrays. Joining every string array would silently corrupt a user's role
 * list into one nonsense role.
 */

export function toCamelCase(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

/**
 * Build a Kimai request body from validated tool parameters.
 *
 * Keys in `excludedKeys` are control fields (authorization, response format,
 * path IDs) that must never reach Kimai. `extra_fields` is spread last so an
 * explicit passthrough value wins over a modeled one.
 */
export function buildPayload(
  params: Record<string, unknown>,
  excludedKeys: string[],
  joinKeys: string[] = ["tags"]
): Record<string, unknown> {
  const excluded = new Set([...excludedKeys, "extra_fields"]);
  const join = new Set(joinKeys);
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (excluded.has(key) || value === undefined || value === null || value === "") continue;
    payload[toCamelCase(key)] = join.has(key) && Array.isArray(value) ? value.join(",") : value;
  }

  const extra = params.extra_fields;
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    Object.assign(payload, extra as Record<string, unknown>);
  }

  return payload;
}
