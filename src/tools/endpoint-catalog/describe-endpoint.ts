import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadEndpointSpec, loadEnrichment, loadIndex } from "../../catalog/endpoint-spec.js";
import { ENV } from "../../constants.js";
import { formatApiError } from "../../services/errors.js";
import { makeToolResponse } from "../format.js";

/**
 * kimai_describe_endpoint: the lookup step between discovery and execution.
 *
 * Returns the full EndpointSpec for one operation: path params, query params
 * with their types, formats, enums, defaults and PATTERNS, the resolved
 * request body schema, the response codes, and a request sample. A caller is
 * expected to read this before kimai_call_endpoint so it sends the right
 * shape the first time.
 *
 * WHY THE `pattern` FIELD IS THE POINT OF THIS TOOL
 * --------------------------------------------------
 * Kimai encodes several of its measured API behaviours as parameter patterns
 * rather than prose, and those patterns are the difference between a correct
 * call and a silently wrong one. `user` is `\d+|all`, and a timesheet query
 * that omits it returns only the API token owner's rows rather than the
 * team's. `exported` and `billable` are `0|1`, and sending true/false does
 * not filter the way a caller expects. The extractor preserves `pattern`
 * specifically so it can surface here; the markdown rendering below puts it
 * next to each parameter rather than burying it in the JSON.
 *
 * bodySchema is returned verbatim, never summarised, because seeing the real
 * shape of a write body is the whole reason to call this. Cycles and depth
 * were already bounded by the extractor.
 *
 * Unknown operationId does not throw: it returns fuzzy suggestions from the
 * index, so a typo or a guessed id still points somewhere useful. Like
 * kimai_list_endpoints this reads only the on-disk catalog and never contacts
 * Kimai, so it works with no credentials configured.
 */

const DescribeEndpointSchema = z.object({
  operation_id: z
    .string()
    .min(1)
    .describe("The operationId from kimai_list_endpoints, e.g. 'get_timesheets' or 'delete_customer'.")
}).strict();

export function registerDescribeEndpointTool(server: McpServer): void {
  server.registerTool(
    "kimai_describe_endpoint",
    {
      title: "Describe Kimai API Endpoint",
      description:
        "Get the full specification for one Kimai endpoint: method, path, path parameters, query parameters with " +
        "their types, allowed patterns, enums and defaults, the request body schema, response codes, and a request " +
        "sample. Call this before kimai_call_endpoint. Pay attention to the pattern on each parameter: Kimai " +
        "expresses several filter rules there, such as user being '\\d+|all' and the boolean filters being '0|1'. " +
        "This tool is read-only and never contacts the Kimai server.",
      inputSchema: DescribeEndpointSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params) => {
      const operationId = params.operation_id;

      try {
        const spec = loadEndpointSpec(operationId);

        if (!spec) {
          const known = loadIndex().endpoints.map((e) => e.operationId);
          const suggestions = known
            .filter((id) => id.includes(operationId) || operationId.includes(id))
            .slice(0, 5);
          const message =
            `Unknown endpoint "${operationId}". ` +
            (suggestions.length ? `Did you mean: ${suggestions.join(", ")}? ` : "") +
            `Call kimai_list_endpoints to discover endpoints.`;
          const data = { error: message };
          return makeToolResponse(data, message, true);
        }

        const enrichment = loadEnrichment(operationId);

        const data = {
          ...spec,
          enrichment: enrichment ?? null,
          // Names the env var only, never its value. Deletes are the only
          // gated class on this server; ordinary writes are not gated.
          delete_gate_env: spec.destructive ? ENV.allowDelete : null
        };

        const describeParam = (p: (typeof spec.params)[number]) => {
          const bits = [
            `\`${p.name}\``,
            `(${p.type}${p.required ? ", required" : ""})`,
            ...(p.pattern ? [`pattern \`${p.pattern}\``] : []),
            ...(p.enum ? [`one of ${JSON.stringify(p.enum)}`] : []),
            ...(p.default !== undefined ? [`default ${JSON.stringify(p.default)}`] : [])
          ].join(" ");
          return `- ${bits}${p.description ? ` -- ${p.description}` : ""}`;
        };

        const sections: string[] = [
          `# ${spec.name}`,
          "",
          `\`${spec.operationId}\` -- ${spec.method} ${spec.path}`,
          "",
          `Category: ${spec.category} | ${spec.writeOperation ? "WRITE" : "read"}` +
            `${spec.destructive ? " | DESTRUCTIVE" : ""}` +
            `${spec.deprecated ? " | DEPRECATED" : ""}` +
            `${spec.pluginOnly ? " | PLUGIN-ONLY" : ""}`,
          ""
        ];

        if (spec.description) sections.push(spec.description, "");

        if (spec.pluginOnly) {
          sections.push(
            "This endpoint requires a paid Kimai plugin. It is absent from the open-source API " +
              "documentation, so its parameters were reconstructed from observed behavior rather than " +
              "from a published specification. A 404 here means the plugin is not installed.",
            ""
          );
        }

        if (spec.deprecated) {
          sections.push("Kimai marks this endpoint deprecated. It still functions in 2.65.0.", "");
        }

        if (spec.destructive) {
          const reason = enrichment?.destructiveReason;
          sections.push(
            `DESTRUCTIVE. ${reason ? `${reason} ` : ""}Requires ${ENV.allowDelete} to be enabled on this ` +
              `server, plus authorization_confirmed and authorization_note on the call.`,
            ""
          );
        }

        if (spec.pathParams.length) {
          sections.push("## Path parameters", "", ...spec.pathParams.map(describeParam), "");
        }
        if (spec.params.length) {
          sections.push(`## Query parameters (${spec.params.length})`, "", ...spec.params.map(describeParam), "");
        }
        if (spec.bodySchema) {
          sections.push(
            `## Request body (${spec.bodyContentType})`,
            "",
            "```json",
            JSON.stringify(spec.bodySchema, null, 2),
            "```",
            ""
          );
        }

        const responseCodes = Object.entries(spec.responses).map(
          ([code, r]) => `- ${code}: ${(r as { description?: string })?.description ?? ""}`
        );
        if (responseCodes.length) sections.push("## Responses", "", ...responseCodes, "");

        if (enrichment?.usageNotes) sections.push("## Usage notes", "", enrichment.usageNotes, "");
        if (enrichment?.tips?.length) {
          sections.push("## Tips", "", ...enrichment.tips.map((t) => `- ${t}`), "");
        }
        if (enrichment?.relatedOperations?.length) {
          sections.push(`Related: ${enrichment.relatedOperations.map((o) => `\`${o}\``).join(", ")}`, "");
        }

        sections.push("## Request sample", "", "```sh", spec.requestSample, "```");

        return makeToolResponse(data, sections.join("\n"));
      } catch (error) {
        const data = { error: formatApiError(error) };
        return makeToolResponse(data, data.error, true);
      }
    }
  );
}
