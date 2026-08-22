import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EndpointParam, EndpointSpec } from "../../catalog/endpoint-spec.js";
import { loadEndpointSpec, loadEnrichment, loadIndex } from "../../catalog/endpoint-spec.js";
import { DELETE_GATE_MESSAGE, ENV } from "../../constants.js";
import type { KimaiClient } from "../../services/kimai-client.js";
import { writeMutationBackup } from "../../services/backups.js";
import { collectAffectedTimesheets, collectChildren } from "../../services/cascade.js";
import { formatApiError } from "../../services/errors.js";
import { makeToolResponse } from "../format.js";

/**
 * kimai_call_endpoint: the only catalog tool that reaches the Kimai server.
 *
 * It is the single choke point for every catalog-driven write and delete, so
 * it runs a fixed chain before it opens a socket:
 *
 *   1. Unknown operation_id      -> fuzzy-suggestion error, no network call.
 *   2. Missing required path params -> named error, no network call.
 *   3. Parameter coercion         -> fix or refuse the query shapes Kimai
 *                                    mishandles silently (see below).
 *   4. Write authorization        -> writeOperation requires
 *                                    authorization_confirmed + note.
 *   5. DELETE GATE                -> destructive requires KIMAI_ALLOW_DELETE.
 *   6. Backup + cascade snapshot  -> written BEFORE the request is sent.
 *   7. Execute.
 *
 * THE DELETE GATE IS CHECKED AFTER AUTHORIZATION HERE, AND THAT IS DELIBERATE
 * ----------------------------------------------------------------------------
 * arr's equivalent tool checks its write gate BEFORE its destructive confirm,
 * because there a confirm cannot possibly make the call succeed while writes
 * are off, so asking for it first would be a half-truth. The two conditions
 * are inverted on this server: authorization is a per-call argument the model
 * controls and can supply immediately, while KIMAI_ALLOW_DELETE is server
 * configuration that requires a human to change an env var and restart. So
 * the cheap, self-serviceable requirement is reported first, and the gate,
 * which is the harder stop, is reported last and is the message a caller ends
 * on. Both are checked before any network call either way, so no ordering
 * here can leak a request; this is about which blocker a caller is told to
 * fix first. Layer 6 then still runs before the request itself, exactly as in
 * registerDeleteTool, because after a successful delete the backup file is
 * the only remaining copy.
 *
 * THE GATE AND THE BACKUP BEHAVE IDENTICALLY TO THE CURATED TOOLS
 * ----------------------------------------------------------------
 * A delete reached through this generic tool is subject to the same
 * KIMAI_ALLOW_DELETE gate, the same authorization fields, and the same
 * pre-delete backup as kimai_delete_customer. Anything less would make the
 * catalog a way to route around the curated tools' safety, which would be
 * worse than not shipping the catalog at all.
 *
 * WHY THIS TOOL COERCES PARAMETERS INSTEAD OF PASSING THEM THROUGH
 * -----------------------------------------------------------------
 * Kimai discards query filters it does not understand rather than rejecting
 * them, so a malformed filter returns a 200 with the WRONG ROWS. Measured on
 * the live instance: `tags` sent as the comma string "bar,foo" returned 500
 * of 500 rows completely unfiltered, while `tags[]=bar&tags[]=foo` returned
 * the right 0. A generic pass-through would reproduce that silent failure on
 * every endpoint at once. So coerceParams below turns the three shapes Kimai
 * mishandles into either a correct value or a loud error, and warns about
 * parameters the endpoint does not declare. A loud error costs one retry; a
 * silently unfiltered result costs a wrong answer nobody notices.
 */

const CallEndpointSchema = z.object({
  operation_id: z
    .string()
    .min(1)
    .describe("The operationId to call. See kimai_list_endpoints and kimai_describe_endpoint."),
  path_params: z
    .record(z.any())
    .optional()
    .describe("Values for {placeholder} segments in the path, e.g. { id: 42 }."),
  params: z
    .record(z.any())
    .optional()
    .describe(
      "Query parameters for GET and DELETE, or the JSON body object for POST/PATCH/PUT. Call " +
        "kimai_describe_endpoint first for the exact names and allowed values."
    ),
  query: z
    .record(z.any())
    .optional()
    .describe(
      "Query parameters for a write that also takes them. Only POST /api/timesheets needs this, for its " +
        "'full' parameter; for every other endpoint use 'params'."
    ),
  authorization_confirmed: z
    .literal(true)
    .optional()
    .describe(
      "Required for any write (POST/PATCH/PUT/DELETE). Set true only after the human user explicitly " +
        "authorizes this Kimai change. Not needed for reads."
    ),
  authorization_note: z
    .string()
    .min(8)
    .optional()
    .describe("Required for any write. Short note capturing the user's authorization and the reason."),
  response_format: z
    .enum(["markdown", "json"])
    .default("markdown")
    .describe("Output format: markdown for a readable summary, json for the raw response.")
}).strict();

/**
 * Snapshots the dependents a cascading delete will also destroy, keyed by
 * operationId. Kimai's own API documentation flags these three: deleting a
 * customer takes its projects, their activities, and every linked timesheet
 * with it, and there is no undo. These are the same collectors the curated
 * kimai_delete_customer / _project / _activity tools use, so a delete routed
 * through the catalog produces the same backup contents as one routed through
 * the curated tool.
 *
 * An operationId absent from this map simply has no dependents worth
 * snapshotting (deleting a timesheet or a rate destroys only itself); it is
 * not an oversight and does not skip the ordinary `before` backup.
 */
const CASCADES: Record<string, (client: KimaiClient, id: string) => Promise<Record<string, unknown>>> = {
  delete_customer: async (client, id) => {
    const projects = await collectChildren(client, "/api/projects", { customers: [id], visible: 3 });
    const timesheets = await collectAffectedTimesheets(client, "customers", id);
    return { projects, ...timesheets };
  },
  delete_project: async (client, id) => {
    const activities = await collectChildren(client, "/api/activities", { projects: [id], visible: 3 });
    const timesheets = await collectAffectedTimesheets(client, "projects", id);
    return { activities, ...timesheets };
  },
  delete_activity: async (client, id) => collectAffectedTimesheets(client, "activities", id)
};

const VISIBILITY_WORDS: Record<string, number> = { visible: 1, hidden: 2, all: 3 };

/**
 * Turn caller-supplied query parameters into the shapes Kimai actually
 * honours, or refuse them. Returns coerced values plus human-readable
 * warnings; a non-empty `errors` array means the call must not be sent.
 *
 * Each rule below exists because of a measured behaviour, not a style
 * preference:
 *
 *   - Array parameters (`tags[]`, `customers[]`, `users[]`, ...) must be sent
 *     repeated. A comma string is accepted by Kimai and then IGNORED, which
 *     returns unfiltered rows with a 200. A string containing a comma is
 *     therefore refused outright rather than guessed at, because splitting it
 *     would be wrong for any tag that legitimately contains a comma. A single
 *     string with no comma is wrapped into a one-element array, which is
 *     unambiguous and saves a retry.
 *   - Parameters whose pattern is `0|1` are booleans in Kimai's data model but
 *     integers on the wire. true/false is coerced rather than refused; that
 *     mapping has exactly one sensible answer.
 *   - `visible` is `1|2|3` (visible/hidden/all), which nothing about the name
 *     suggests. The three words are accepted and mapped.
 *   - A parameter the endpoint does not declare is WARNED about, not refused.
 *     Kimai drops unknown filters silently, so the caller would otherwise read
 *     a confidently wrong result. It is a warning rather than an error because
 *     the catalog's parameter lists come from Kimai's own documentation, which
 *     has been wrong before: the six plugin endpoints are hand-authored, and
 *     refusing an undocumented-but-real parameter would be worse than flagging
 *     it.
 */
function coerceParams(
  spec: EndpointSpec,
  supplied: Record<string, unknown>
): { values: Record<string, unknown>; warnings: string[]; errors: string[] } {
  const values: Record<string, unknown> = {};
  const warnings: string[] = [];
  const errors: string[] = [];

  const byName = new Map<string, EndpointParam>();
  for (const p of spec.params) {
    byName.set(p.name, p);
    // Kimai names its repeatable filters with a literal "[]" suffix. Accept the
    // bare name too, since axios appends the brackets on the wire either way
    // and a caller reading the description is as likely to type one as the other.
    if (p.name.endsWith("[]")) byName.set(p.name.slice(0, -2), p);
  }

  for (const [key, raw] of Object.entries(supplied)) {
    if (raw === undefined || raw === null) continue;

    const param = byName.get(key);
    if (!param) {
      warnings.push(
        `"${key}" is not a documented parameter of ${spec.operationId}. Kimai silently ignores filters ` +
          `it does not recognize rather than rejecting them, so if this was meant to narrow the result, ` +
          `the result you get back will be wider than you expect.`
      );
      values[key] = raw;
      continue;
    }

    // Always send under the name the spec declares, so a caller who passed
    // "tags" does not end up with a differently-keyed duplicate.
    const wireName = param.name;

    if (param.type === "array") {
      if (Array.isArray(raw)) {
        values[wireName] = raw.map((v) => String(v));
      } else if (typeof raw === "string" && raw.includes(",")) {
        errors.push(
          `"${key}" must be an array, not a comma-separated string. Kimai accepts "${raw}" and then ` +
            `ignores it, returning UNFILTERED results with a success status rather than an error. ` +
            `Pass ${JSON.stringify(raw.split(",").map((s) => s.trim()))} instead.`
        );
      } else {
        values[wireName] = [String(raw)];
      }
      continue;
    }

    if (param.pattern === "0|1" && typeof raw === "boolean") {
      values[wireName] = raw ? 1 : 0;
      continue;
    }

    if (param.pattern === "1|2|3" && typeof raw === "string") {
      const mapped = VISIBILITY_WORDS[raw.toLowerCase()];
      if (mapped !== undefined) {
        values[wireName] = mapped;
        continue;
      }
    }

    values[wireName] = raw;
  }

  // The undercount that already cost a real billing total once. Only fires on
  // endpoints that actually accept the parameter, so it cannot misfire on the
  // per-user endpoints where owner-scoping is the correct behaviour.
  const userParam = spec.params.find((p) => p.name === "user" && p.pattern === "\\d+|all");
  if (userParam && values.user === undefined) {
    warnings.push(
      `No "user" parameter was sent. ${spec.operationId} defaults to the API token owner only, so this ` +
        `result covers one user rather than the team. Pass user: "all" for everyone (needs the ` +
        `view_other_timesheet permission), or a numeric user ID for one specific person.`
    );
  }

  return { values, warnings, errors };
}

/** Substitute {placeholders} in the catalog path with the caller's values. */
function buildPath(spec: EndpointSpec, pathParams: Record<string, unknown>): string {
  return spec.path.replace(/\{([^}]+)\}/g, (_match, name: string) =>
    encodeURIComponent(String(pathParams[name]))
  );
}

export function registerCallEndpointTool(server: McpServer, client: KimaiClient): void {
  server.registerTool(
    "kimai_call_endpoint",
    {
      title: "Call Kimai API Endpoint",
      description:
        "Execute any of the 91 Kimai API endpoints by operationId and return the response. Validates the " +
        "operationId and required path parameters against the catalog, corrects or refuses the query shapes " +
        "Kimai mishandles silently, requires authorization_confirmed and authorization_note for every write, " +
        "enforces the " +
        ENV.allowDelete +
        " gate and writes a backup before any delete, then executes. Reads always run. Call " +
        "kimai_describe_endpoint first to learn the exact parameters.",
      inputSchema: CallEndpointSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params) => {
      const operationId = params.operation_id;
      const asJson = params.response_format === "json";
      const fail = (message: string) => makeToolResponse({ error: message }, message, true);

      // 1. Unknown operation_id. No network call.
      const spec = loadEndpointSpec(operationId);
      if (!spec) {
        const known = loadIndex().endpoints.map((e) => e.operationId);
        const suggestions = known
          .filter((id) => id.includes(operationId) || operationId.includes(id))
          .slice(0, 5);
        return fail(
          `Unknown endpoint "${operationId}". ` +
            (suggestions.length ? `Did you mean: ${suggestions.join(", ")}? ` : "") +
            `Call kimai_list_endpoints to discover endpoints.`
        );
      }

      // 2. Missing required path params. No network call.
      const suppliedPathParams = params.path_params ?? {};
      const missing = spec.pathParams
        .filter((p) => p.required)
        .filter((p) => {
          const v = suppliedPathParams[p.name];
          return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
        })
        .map((p) => p.name);
      if (missing.length) {
        return fail(
          `Missing required path parameter(s) for "${spec.operationId}" (${spec.method} ${spec.path}): ` +
            `${missing.join(", ")}. Call kimai_describe_endpoint for the full signature.`
        );
      }

      // 3. Parameter coercion. Query params only; a request body is passed
      // through untouched, since Kimai validates bodies properly and answers
      // a bad one with a 400 rather than silently ignoring it.
      const sendsBody = spec.bodySchema !== null;
      const body = sendsBody ? params.params : undefined;
      const rawQuery = sendsBody ? (params.query ?? {}) : (params.params ?? {});
      const { values: query, warnings, errors } = coerceParams(spec, rawQuery);
      if (errors.length) {
        return fail(
          `Cannot call "${spec.operationId}" as specified:\n` + errors.map((e) => `- ${e}`).join("\n")
        );
      }

      // 4. Write authorization. Cheap and self-serviceable, so reported first.
      if (spec.writeOperation) {
        if (params.authorization_confirmed !== true || !params.authorization_note) {
          return fail(
            `"${spec.operationId}" is a WRITE (${spec.method} ${spec.path}). Set authorization_confirmed: ` +
              `true and authorization_note only after the human user has explicitly authorized this change.`
          );
        }
      }

      // 5. DELETE GATE. Server configuration, so reported last: it is the
      // blocker a human has to clear. See the top-of-file note on ordering.
      if (spec.destructive && !client.allowDelete) {
        const enrichment = loadEnrichment(operationId);
        const reason = enrichment?.destructiveReason;
        return fail(`${DELETE_GATE_MESSAGE}${reason ? ` ${reason}` : ""}`);
      }

      try {
        const endpoint = buildPath(spec, suppliedPathParams);

        // 6. Backup before the request. Deletes get the record plus any
        // cascade snapshot; other writes get the prior state where the
        // endpoint is a single-record path we can read back.
        let backupFile: string | undefined;
        let cascade: Record<string, unknown> | undefined;
        let before: unknown;

        if (spec.writeOperation) {
          const readable = spec.method !== "POST" && spec.pathParams.some((p) => p.name === "id");
          if (readable) {
            try {
              before = (await client.get<unknown>(endpoint)).data;
            } catch {
              // A prior-state read that fails must not block the operation the
              // user authorized. The backup simply records what could be read.
              before = undefined;
            }
          }

          if (spec.destructive) {
            const collect = CASCADES[spec.operationId];
            if (collect) cascade = await collect(client, String(suppliedPathParams.id));
          }

          backupFile = await writeMutationBackup({
            operation: `kimai_call_endpoint:${spec.operationId}`,
            endpoint: `${spec.method} ${endpoint}`,
            authorization_note: String(params.authorization_note ?? ""),
            before,
            request: cascade ?? body
          });
        }

        // 7. Execute.
        let result: unknown;
        switch (spec.method) {
          case "GET":
            result = (await client.get<unknown>(endpoint, query)).data;
            break;
          case "DELETE":
            result = (await client.delete<unknown>(endpoint, query)).data;
            break;
          case "POST":
            result = (await client.post<unknown>(endpoint, body as never, query)).data;
            break;
          case "PATCH":
          case "PUT":
            result = (await client.patch<unknown>(endpoint, body as never, query)).data;
            break;
          default:
            return fail(`Unsupported method ${spec.method} on ${spec.operationId}.`);
        }

        const data = {
          operation_id: spec.operationId,
          method: spec.method,
          path: endpoint,
          ...(backupFile ? { backup_file: backupFile } : {}),
          ...(cascade ? { cascade } : {}),
          ...(warnings.length ? { warnings } : {}),
          result
        };

        const cascadeLine = cascade
          ? `Cascade captured: ${Object.entries(cascade)
              .map(([k, v]) => `${k}=${Array.isArray(v) ? v.length : String(v)}`)
              .join(", ")}`
          : null;

        const markdown = [
          `# ${spec.name}`,
          "",
          `\`${spec.operationId}\` -- ${spec.method} ${endpoint}`,
          ...(spec.destructive
            ? ["", "Kimai has no undo for deletes. The backup file is the only remaining copy."]
            : []),
          ...(backupFile ? ["", `Backup file: ${backupFile}`] : []),
          ...(cascadeLine ? ["", cascadeLine] : []),
          ...(warnings.length ? ["", "## Warnings", "", ...warnings.map((w) => `- ${w}`)] : []),
          "",
          "## Result",
          "",
          "```json",
          JSON.stringify(result, null, 2),
          "```"
        ].join("\n");

        return makeToolResponse(data, asJson ? JSON.stringify(data, null, 2) : markdown);
      } catch (error) {
        const data = { error: formatApiError(error) };
        return makeToolResponse(data, data.error, true);
      }
    }
  );
}
