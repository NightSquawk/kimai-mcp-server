import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createCatalogStore, type CatalogStore } from "@nightsquawktech/mcp-core/catalog";

/**
 * Type home and catalog loader for the kimai-mcp-server catalog tools.
 *
 * WHY THIS SERVER IS A HYBRID AND NOT A PURE CATALOG
 * ---------------------------------------------------
 * The other catalog-backed NST servers (arr, proxmox, invoiceninja, qui)
 * are pure: three generic tools, zero named tools, everything driven off a
 * generated on-disk catalog. This one is deliberately not. Kimai has 88
 * operations, which is small enough that a pure catalog would trade away
 * something valuable for very little context savings.
 *
 * The thing being traded away is eight measured API defects. Kimai's REST
 * layer has behaviours that are not discoverable from the endpoint list and
 * that silently produce WRONG ANSWERS rather than errors:
 *
 *   - GET /api/timesheets defaults to the API token owner only. A report
 *     meant to cover the team silently undercounts unless it passes
 *     user: "all". This already caused a real billing miscount once.
 *   - The tags filter must be sent as tags[]=a&tags[]=b. Sent as a comma
 *     string it returns UNFILTERED data (measured: 500 of 500 rows) rather
 *     than erroring, so the caller cannot tell it went wrong.
 *   - Booleans must be 0|1, visibility must be 1|2|3, and Kimai discards
 *     filters it does not understand instead of rejecting them.
 *
 * A generic call_endpoint cannot encode "you almost certainly meant
 * user: all here". A curated tool's Zod description can, and does. So the
 * high-traffic, high-blast-radius surface (timesheets, plus the three most
 * common lookups) keeps hand-written tools with those warnings baked into
 * the schema, and the long tail of 70+ rarely-used operations moves behind
 * the three catalog tools where its only cost is one index lookup.
 *
 * Measured context cost, tools/list payload:
 *   63 curated tools (v0.2.0)   94,811 bytes   ~24,000 tokens standing
 *   3 catalog tools              ~2,500 bytes     ~700 tokens
 *   12 curated + 3 catalog       ~20,000 bytes  ~5,000 tokens
 *
 * SINGLE SERVICE, SO NO SERVICE UNION
 * ------------------------------------
 * arr's equivalent file carries a four-member Service union because it
 * ships four catalogs (catalog-sonarr, catalog-radarr, ...). Kimai is one
 * product with one catalog, so there is no union, no SERVICE_META map, and
 * no per-service store cache -- just KIMAI_META and a single lazily built
 * store. The EndpointSpec and IndexEntry shapes intentionally keep the same
 * field names as arr's so that anyone who has read one server's catalog
 * code can read the other's, but the `service` field is dropped rather than
 * pinned to a constant "kimai": a field that can only ever hold one value
 * is noise in every generated JSON file and every tool response.
 *
 * THE INVERTED PATH-RESOLUTION RULE (read before touching that section)
 * ----------------------------------------------------------------------
 * The catalog directory is resolved HERE, in the server, and never inside
 * @nightsquawktech/mcp-core. createCatalogStore() takes an already-resolved
 * absolute directory and has no opinion about where catalogs live. That is
 * deliberate: mcp-core is shared across several catalog-backed servers,
 * each bundling its catalog at a different relative location under its own
 * dist/. "One level up from mine" only means something relative to THIS
 * compiled file, so it has to be computed in this file.
 *
 * Concretely: this compiles to dist/catalog/endpoint-spec.js, so
 * dirname(fileURLToPath(import.meta.url)) is dist/catalog. The catalog is
 * copied to dist/catalog-kimai/ as a build step (a SIBLING of dist/catalog,
 * not nested inside it), so the path is join(dist/catalog, "..",
 * "catalog-kimai"). Forgetting the ".." hop silently points at a directory
 * that does not exist; nothing in the type checker catches it and every
 * catalog tool call fails at runtime with "index.json not found".
 */

/** Methods observed across the vendored Kimai 2.65.0 spec. */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/** A single path or query parameter on an operation. */
export interface EndpointParam {
  name: string;
  /** "string" | "integer" | "number" | "boolean" | "array" | "object" */
  type: string;
  required: boolean;
  description?: string;
  format?: string;
  /**
   * The parameter's regex constraint, preserved where arr's catalog drops it.
   * Kimai states several of its filter rules ONLY here, and they are the rules
   * a caller gets wrong: `\d+|all` on `user` (omit it and a team report
   * silently covers one person), `0|1` on `exported` and `billable` (booleans
   * that are integers on the wire), `1|2|3` on `visible`. kimai_call_endpoint
   * reads this field to coerce or refuse those shapes, so dropping it would
   * disable that checking rather than merely lose documentation.
   */
  pattern?: string;
  /** Element schema for array-typed parameters such as `tags[]`. */
  items?: any;
  enum?: any[];
  default?: any;
  in?: "path" | "query";
}

/** Resolved JSON Schema for a request body. Cycles elided, depth-limited. */
export type BodySchema = Record<string, any>;

/** The full specification for one API operation, stored at endpoints/<operationId>.json. */
export interface EndpointSpec {
  /** From the spec's own operationId when present, else synthesized from method + path. */
  operationId: string;
  /** First path segment after /api, e.g. "timesheets". */
  resource: string;
  /** OpenAPI tags[0], else titlecased resource. */
  category: string;
  /** op.summary, else "<METHOD> <path>". */
  name: string;
  method: HttpMethod;
  /** FULL path including the /api prefix, e.g. "/api/timesheets/{id}". */
  path: string;
  /** op.description, else op.summary, else "". */
  description: string;
  /** method !== "GET" */
  writeOperation: boolean;
  destructive: boolean;
  paramLocation: "query" | "body";
  pathParams: EndpointParam[];
  /** QUERY params only. Never body fields. */
  params: EndpointParam[];
  bodySchema: BodySchema | null;
  /** "application/json" or null. */
  bodyContentType: string | null;
  /** Response code -> { description, schemaRef? }. */
  responses: Record<string, any>;
  /** Human-readable curl-ish example. */
  requestSample: string;
  /**
   * Kimai marks the operation deprecated but it still functions. Only the one
   * such endpoint survives assembly (GET /api/tags); operations whose
   * description starts "REMOVED:" are tombstones that return 410 and are
   * excluded from the catalog entirely. Surfaced so describe_endpoint can say
   * so rather than presenting it as current.
   */
  deprecated?: boolean;
  /**
   * True for the six endpoints that exist only when a paid Kimai plugin is
   * installed (expenses, tasks, absences, public holidays). They are absent
   * from the OSS image's /api/doc, so their catalog entries are
   * hand-authored in _source/plugin-endpoints.json rather than extracted.
   * A 404 from one of these means the plugin is not installed, not that the
   * catalog is wrong, and call_endpoint says so in its error text.
   */
  pluginOnly?: boolean;
}

/** The compact summary of one operation, stored inside CatalogIndex.endpoints. */
export interface IndexEntry {
  operationId: string;
  resource: string;
  category: string;
  name: string;
  method: HttpMethod;
  path: string;
  description: string;
  writeOperation: boolean;
  destructive: boolean;
  pluginOnly?: boolean;
}

/** The aggregate index, stored at index.json. */
export interface CatalogIndex {
  product: string;
  /** e.g. "Kimai 2.65.0 /api/doc apiDescriptionDocument" */
  generatedFrom: string;
  /** Always "/api". */
  apiPrefix: string;
  /** "$KIMAI_BASE_URL" */
  defaultBaseUrl: string;
  /** Always "Authorization: Bearer". */
  authScheme: string;
  endpointCount: number;
  readCount: number;
  writeCount: number;
  destructiveCount: number;
  /** Sorted, unique. */
  categories: string[];
  endpoints: IndexEntry[];
}

/** Optional additive layer, stored at enrichment/<operationId>.json. Never contains structural fields. */
export interface Enrichment {
  operationId: string;
  usageNotes?: string;
  examples?: any[];
  destructiveReason?: string;
  tips?: string[];
  relatedOperations?: string[];
}

/**
 * Single source of truth for Kimai's API-level metadata. The catalog
 * assembler writes these same values into index.json; anything at runtime
 * that needs them reads them from here rather than re-listing them.
 */
export const KIMAI_META = {
  product: "Kimai",
  apiPrefix: "/api",
  defaultBaseUrl: "$KIMAI_BASE_URL",
  authScheme: "Authorization: Bearer",
} as const;

// Path resolution stays HERE, in the server, so it points at this server's
// own bundled catalog (dist/catalog-kimai) rather than inside the shared
// mcp-core package. See the top-of-file comment for the full reasoning.
const baseDir = dirname(fileURLToPath(import.meta.url)); // dist/catalog
const catalogDir = join(baseDir, "..", "catalog-kimai");

let cached: CatalogStore<CatalogIndex> | null = null;
function store(): CatalogStore<CatalogIndex> {
  if (!cached) cached = createCatalogStore<CatalogIndex>(catalogDir);
  return cached;
}

/** Loads (and caches) the aggregate index. */
export function loadIndex(): CatalogIndex {
  return store().index();
}

/** Loads a single operation's full spec, or null if the id is unknown. */
export function loadEndpointSpec(operationId: string): EndpointSpec | null {
  // Entries live under endpoints/; the core store guards against path traversal.
  return store().entry<EndpointSpec>(operationId);
}

/** Loads the optional additive enrichment for an operation, or null if absent. */
export function loadEnrichment(operationId: string): Enrichment | null {
  // Optional layer under enrichment/ -- missing files resolve to null, not an error.
  return store().entry<Enrichment>(operationId, "enrichment");
}

/** Whether operationId appears in the index. */
export function isKnownEndpoint(operationId: string): boolean {
  return loadIndex().endpoints.some((e) => e.operationId === operationId);
}
