#!/usr/bin/env node
/**
 * Stage 1 of the Kimai catalog build: OpenAPI spec -> normalized per-operation raw JSON.
 *
 * Reads the vendored Kimai OpenAPI document at _source/kimai-<version>-openapi.json,
 * flattens every supported operation into the shape the assembler expects, and writes one
 * file per operation to _source/raw/<operationId>.json. It performs NO derivation and makes
 * NO judgements: fields like `destructive`, `category`, and `requestSample` are the
 * assembler's job (scripts/assemble-catalog.mjs, stage 2). Keeping extraction free of
 * derived fields is what lets the assembler be re-run to change a rule without re-parsing
 * the 213 KB spec, and what keeps this file a plain OpenAPI 3 reader.
 *
 * This is a port of arr-mcp-server/scripts/extract-openapi.mjs. The resolver, the parameter
 * mapper, and the SAFE_ID / collision guards are carried over unchanged, because they encode
 * CONTRACT.md rules rather than anything *arr-specific. Three things differ, all documented
 * at their site below: the single-service config, the operationId source, and the
 * plugin-endpoint merge.
 *
 * Usage:  node scripts/extract-openapi.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------------------
// Source config. Kimai is a single product with a single spec, so where arr carries a
// four-entry SERVICES map and takes the service as argv[2], this is one constant and the
// script takes no arguments. The spec file is discovered by prefix rather than pinned to an
// exact version string, so bumping Kimai means dropping in the new dump and re-running,
// with no edit here. Exactly one match is required: two vendored specs in _source/ is an
// ambiguity the build should refuse rather than resolve by sort order.
// ---------------------------------------------------------------------------------------
const SPEC_PREFIX = "kimai-";
const SPEC_SUFFIX = "-openapi.json";

// Hand-authored entries for endpoints that exist only under paid Kimai plugins. See the
// merge site near the bottom of extract() for why these cannot be extracted.
const PLUGIN_SPEC_FILE = "plugin-endpoints.json";

// OpenAPI 3 defines eight possible operation verbs per path item. The catalog's HttpMethod
// type (src/catalog/endpoint-spec.ts) covers five. head/trace/options are skipped rather
// than forced into a shape that has no slot for them.
const SUPPORTED_METHODS = ["get", "post", "put", "delete", "patch"];

const DEPTH_LIMIT = 4;

// ---------------------------------------------------------------------------------------
// operationId. UNLIKE the *arr specs -- which carry no operationId at all, forcing arr's
// extractor to synthesize every id from method + path -- Kimai's Nelmio-generated document
// declares one on all 88 operations. Measured on 2.65.0: 88/88 present, 88/88 unique, 88/88
// already matching mcp-core's SAFE_ID. They are also substantially more readable than
// synthesized ids ("delete_activity" against "delete_api_activities_id"), and readability is
// not cosmetic here: the operationId is the string a model has to pick out of list_endpoints
// output and pass back to describe_endpoint and call_endpoint.
//
// So the spec's own id is preferred, and synthesis is the fallback for any operation that
// omits one or whose id fails SAFE_ID. The fallback is arr's rule copied verbatim, so an
// id produced by either path is legal in either catalog.
//
// The cost of preferring spec ids: they are upstream's to rename. If a future Kimai version
// renames an operation, its catalog id changes and any enrichment/<id>.json written against
// the old id silently stops applying. That is why the assembler warns about orphaned
// enrichment files rather than ignoring them.
// ---------------------------------------------------------------------------------------
function synthesizeOperationId(method, path) {
  const flattened = path
    .replace(/\{(\w+)\}/g, "$1")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\//g, "_");
  return `${method.toLowerCase()}_${flattened}`.replace(/[^A-Za-z0-9_]/g, "_").toLowerCase();
}

// mcp-core's SAFE_ID rule: operation ids must be lowercase alnum + underscore only, or they
// silently become null at tool-registration time. Asserted at build time so a bad id is a
// thrown error here, not a mystery failure three files downstream.
const SAFE_ID = /^[a-z0-9_]+$/;

function refName(ref) {
  // Refs in this spec are always local: "#/components/schemas/<Name>".
  const parts = ref.split("/");
  return parts[parts.length - 1];
}

/**
 * Resolve a JSON Schema fragment that may contain $ref, allOf, oneOf, anyOf, arrays and
 * nested objects, into a fully inlined schema. Tracks the $ref stack so a revisited schema
 * name is elided instead of recursed into (cycle guard), and gives up past DEPTH_LIMIT.
 * Both guards report which one fired so the summary printed at the end of a run can be
 * trusted rather than guessed at.
 *
 * @param {any} node - schema fragment to resolve
 * @param {Record<string, any>} schemas - components.schemas from the source spec
 * @param {string[]} stack - names of schemas currently being descended into (cycle guard)
 * @param {number} depth - current resolution depth (depth guard)
 * @param {{ cycles: number, depthLimited: number }} stats - mutated in place for the summary
 * @returns {any} inlined schema fragment
 */
function resolveSchema(node, schemas, stack, depth, stats) {
  if (node === null || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    return node.map((item) => resolveSchema(item, schemas, stack, depth, stats));
  }

  if (typeof node.$ref === "string") {
    const name = refName(node.$ref);
    if (stack.includes(name)) {
      stats.cycles++;
      return { $ref: `#/components/schemas/${name}`, note: "cycle elided" };
    }
    if (depth >= DEPTH_LIMIT) {
      stats.depthLimited++;
      return { $ref: `#/components/schemas/${name}`, note: "depth limit" };
    }
    const target = schemas[name];
    if (target === undefined) {
      // Dangling ref: preserve it faithfully rather than throwing. A spec that references a
      // schema it never defines is an upstream problem to surface, not to paper over.
      return { $ref: `#/components/schemas/${name}`, note: "unresolved: schema not found" };
    }
    return resolveSchema(target, schemas, [...stack, name], depth + 1, stats);
  }

  const out = {};

  // `nullable`-only noise is dropped on purpose: it carries no structural information a
  // caller needs, and OpenAPI 3.0's `nullable: true` has no bearing on required/type/shape.
  const KEEP = ["type", "format", "enum", "description", "pattern"];
  for (const key of KEEP) {
    if (node[key] !== undefined) out[key] = node[key];
  }

  if (node.items !== undefined) {
    out.items = resolveSchema(node.items, schemas, stack, depth, stats);
  }

  if (node.properties !== undefined) {
    out.properties = {};
    for (const [propName, propSchema] of Object.entries(node.properties)) {
      out.properties[propName] = resolveSchema(propSchema, schemas, stack, depth, stats);
    }
  }

  if (node.required !== undefined) out.required = node.required;

  for (const combinator of ["allOf", "oneOf", "anyOf"]) {
    if (node[combinator] !== undefined) {
      out[combinator] = node[combinator].map((member) =>
        resolveSchema(member, schemas, stack, depth, stats),
      );
    }
  }

  if (node.additionalProperties !== undefined && typeof node.additionalProperties === "object") {
    out.additionalProperties = resolveSchema(node.additionalProperties, schemas, stack, depth, stats);
  } else if (node.additionalProperties !== undefined) {
    out.additionalProperties = node.additionalProperties;
  }

  return out;
}

/**
 * Map one OpenAPI parameter object to the EndpointParam shape. Path params are forced to
 * required regardless of what the spec says.
 *
 * `pattern` is carried through where arr's version drops it, and that is load-bearing for
 * Kimai specifically. Kimai encodes three of its measured API defects as parameter patterns
 * rather than as prose: `user` is `\d+|all` (the filter that silently defaults to the token
 * owner), `exported` and `billable` are `0|1` (booleans that must not be sent as
 * true/false), and `full` is `0|1|true|false`. Dropping `pattern` would throw away the only
 * machine-readable warning the spec gives about them.
 *
 * @param {any} param - raw OpenAPI parameter object
 * @param {"path"|"query"} location
 * @param {Record<string, any>} schemas
 * @param {{ cycles: number, depthLimited: number }} stats
 */
function toEndpointParam(param, location, schemas, stats) {
  const resolvedSchema =
    param.schema !== undefined ? resolveSchema(param.schema, schemas, [], 0, stats) : {};

  const out = {
    name: param.name,
    type: resolvedSchema.type ?? "string",
    required: location === "path" ? true : Boolean(param.required),
    in: location,
  };

  const description = param.description ?? resolvedSchema.description;
  if (description !== undefined) out.description = description;
  if (resolvedSchema.format !== undefined) out.format = resolvedSchema.format;
  if (resolvedSchema.pattern !== undefined) out.pattern = resolvedSchema.pattern;
  if (resolvedSchema.enum !== undefined) out.enum = resolvedSchema.enum;
  if (resolvedSchema.items !== undefined) out.items = resolvedSchema.items;
  if (resolvedSchema.default !== undefined) out.default = resolvedSchema.default;
  else if (param.schema && param.schema.default !== undefined) out.default = param.schema.default;

  return out;
}

/** Locate the single vendored spec in _source/, or explain what went wrong. */
function findSpecFile(sourceDir) {
  const matches = readdirSync(sourceDir).filter(
    (f) => f.startsWith(SPEC_PREFIX) && f.endsWith(SPEC_SUFFIX),
  );
  if (matches.length === 0) {
    throw new Error(
      `No spec found in ${sourceDir} matching ${SPEC_PREFIX}*${SPEC_SUFFIX}. ` +
        `See _source/SPEC-SOURCES.txt for how to produce one.`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Multiple specs found in ${sourceDir}: ${matches.join(", ")}. Refusing to guess which ` +
        `version the catalog should be built from. Remove all but one.`,
    );
  }
  return matches[0];
}

function extract(root) {
  const sourceDir = join(root, "_source");
  const specFile = findSpecFile(sourceDir);
  const spec = JSON.parse(readFileSync(join(sourceDir, specFile), "utf8"));

  if (!spec.paths || typeof spec.paths !== "object") {
    throw new Error(`${specFile}: no "paths" object found. Is this a valid OpenAPI 3 document?`);
  }
  const schemas = spec.components?.schemas ?? {};

  const stats = { cycles: 0, depthLimited: 0, withBody: 0, synthesized: 0, plugin: 0 };
  const operations = [];
  const seenIds = new Map(); // operationId -> "METHOD path" of first owner, for collision errors

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [rawMethod, op] of Object.entries(pathItem)) {
      const method = rawMethod.toLowerCase();
      if (!SUPPORTED_METHODS.includes(method)) continue;
      if (op === null || typeof op !== "object") continue;

      const httpMethod = method.toUpperCase();

      // Spec id preferred, synthesis as fallback. See the block comment above.
      let operationId = typeof op.operationId === "string" ? op.operationId.toLowerCase() : "";
      if (!operationId || !SAFE_ID.test(operationId)) {
        operationId = synthesizeOperationId(httpMethod, path);
        stats.synthesized++;
      }

      if (!SAFE_ID.test(operationId)) {
        throw new Error(
          `operationId "${operationId}" for ${httpMethod} ${path} does not match mcp-core's ` +
            `SAFE_ID pattern (/^[a-z0-9_]+$/). Refusing to write a catalog entry that would ` +
            `silently become a null tool id at runtime.`,
        );
      }
      if (seenIds.has(operationId)) {
        throw new Error(
          `operationId collision: "${operationId}" is produced by both ` +
            `${seenIds.get(operationId)} and ${httpMethod} ${path}. Refusing to overwrite the ` +
            `existing raw JSON file for this id.`,
        );
      }
      seenIds.set(operationId, `${httpMethod} ${path}`);

      const pathParams = [];
      const params = [];
      for (const param of op.parameters ?? []) {
        if (param.in === "path") {
          pathParams.push(toEndpointParam(param, "path", schemas, stats));
        } else if (param.in === "query") {
          params.push(toEndpointParam(param, "query", schemas, stats));
        }
        // header/cookie params: none exist in this spec; ignored rather than forced into a
        // shape EndpointParam has no slot for.
      }

      let bodySchema = null;
      let bodyContentType = null;
      if (op.requestBody && op.requestBody.content) {
        const contentTypes = Object.keys(op.requestBody.content);
        bodyContentType = contentTypes.includes("application/json")
          ? "application/json"
          : contentTypes[0] ?? null;
        if (bodyContentType) {
          const rawBodySchema = op.requestBody.content[bodyContentType].schema;
          bodySchema =
            rawBodySchema !== undefined ? resolveSchema(rawBodySchema, schemas, [], 0, stats) : null;
        }
      }
      if (bodySchema !== null) stats.withBody++;

      const responses = {};
      for (const [code, responseObj] of Object.entries(op.responses ?? {})) {
        responses[code] = { description: responseObj?.description ?? "" };
      }

      operations.push({
        method: httpMethod,
        path,
        operationId,
        summary: op.summary ?? null,
        description: op.description ?? null,
        tags: op.tags ?? [],
        deprecated: op.deprecated === true,
        pathParams,
        params,
        bodySchema,
        bodyContentType,
        responses,
      });
    }
  }

  // -------------------------------------------------------------------------------------
  // Plugin endpoint merge.
  //
  // Six endpoints (/api/expenses, /api/expenses/{id}, /api/tasks, /api/tasks/{id},
  // /api/absences, /api/public-holidays) ship only with paid Kimai plugins. The OSS docker
  // image the spec was dumped from does not have those plugins installed, so its /api/doc
  // does not mention them and no amount of re-extraction will produce them. They ARE live on
  // the NST instance and v0.2.0's curated tools call them successfully.
  //
  // Rather than leave a hole in the catalog, their entries are hand-authored in
  // _source/plugin-endpoints.json in this same raw shape and merged here. They are flagged
  // pluginOnly so describe_endpoint and call_endpoint can tell a caller that a 404 means
  // "plugin not installed on this instance", not "the catalog is wrong". Regenerating the
  // catalog from a newer OSS spec preserves them; if a future spec dump ever DOES contain
  // one of these paths, the collision guard above fires and this merge is what to delete.
  // -------------------------------------------------------------------------------------
  const pluginPath = join(sourceDir, PLUGIN_SPEC_FILE);
  if (existsSync(pluginPath)) {
    const pluginOps = JSON.parse(readFileSync(pluginPath, "utf8"));
    for (const op of pluginOps) {
      if (!SAFE_ID.test(op.operationId)) {
        throw new Error(
          `${PLUGIN_SPEC_FILE}: operationId "${op.operationId}" fails SAFE_ID (/^[a-z0-9_]+$/).`,
        );
      }
      if (seenIds.has(op.operationId)) {
        throw new Error(
          `${PLUGIN_SPEC_FILE}: operationId "${op.operationId}" (${op.method} ${op.path}) ` +
            `collides with ${seenIds.get(op.operationId)} from the extracted spec. The upstream ` +
            `spec now covers this endpoint, so its hand-authored entry should be deleted.`,
        );
      }
      seenIds.set(op.operationId, `${op.method} ${op.path}`);
      operations.push({ ...op, pluginOnly: true });
      stats.plugin++;
      if (op.bodySchema) stats.withBody++;
    }
  }

  const rawDir = join(sourceDir, "raw");
  rmSync(rawDir, { recursive: true, force: true });
  mkdirSync(rawDir, { recursive: true });
  for (const op of operations) {
    writeFileSync(join(rawDir, `${op.operationId}.json`), JSON.stringify(op, null, 2) + "\n");
  }

  return { specFile, operations, stats };
}

function main() {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const { specFile, operations, stats } = extract(root);

  const uniqueIds = new Set(operations.map((op) => op.operationId)).size;
  console.log(
    `${specFile}: ${operations.length} operations ` +
      `(${operations.length - stats.plugin} extracted, ${stats.plugin} hand-authored plugin), ` +
      `${uniqueIds} unique operationIds, ${stats.synthesized} ids synthesized, ` +
      `${stats.withBody} with bodySchema, ${stats.cycles} cycles elided, ` +
      `${stats.depthLimited} hit the depth limit`,
  );
}

main();
