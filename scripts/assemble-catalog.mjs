#!/usr/bin/env node
/**
 * Stage 2 of the Kimai catalog build: normalized raw JSON -> the shipped catalog.
 *
 * Reads _source/raw/<operationId>.json (produced by scripts/extract-openapi.mjs) and writes
 * src/catalog-kimai/endpoints/<operationId>.json plus src/catalog-kimai/index.json. Every
 * field this script adds is DERIVED: resource, category, name, description, writeOperation,
 * destructive, paramLocation, requestSample. It parses no OpenAPI, so a rule change here is
 * a cheap re-run rather than a re-parse of the 213 KB spec.
 *
 * Ported from arr-mcp-server/scripts/assemble-catalog.mjs. The derivation helpers and the
 * regeneration discipline are carried over unchanged. What is new is the REMOVED exclusion
 * rule and the orphaned-enrichment check, both documented at their site below.
 *
 * Usage:  node scripts/assemble-catalog.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Mirrors KIMAI_META in src/catalog/endpoint-spec.ts. Kept in sync by hand across exactly
// two sites: a build script cannot import from TypeScript source without a compile step, and
// adding one to a script that runs a handful of times a year is not worth the coupling.
const META = {
  product: "Kimai",
  apiPrefix: "/api",
  defaultBaseUrl: "$KIMAI_BASE_URL",
  authScheme: "Authorization: Bearer",
};

const rawDir = join(root, "_source", "raw");
const outDir = join(root, "src", "catalog-kimai");
const endpointsOut = join(outDir, "endpoints");
const enrichmentOut = join(outDir, "enrichment");

if (!existsSync(rawDir)) {
  console.error(`Missing raw input directory: ${rawDir}`);
  console.error(`Run "node scripts/extract-openapi.mjs" first.`);
  process.exit(1);
}

// --- generatedFrom, from the header line of _source/SPEC-SOURCES.txt ---
function readGeneratedFrom() {
  const text = readFileSync(join(root, "_source", "SPEC-SOURCES.txt"), "utf8");
  for (const line of text.split("\n")) {
    const fields = line.trim().split(/\s+/);
    if (fields[0] !== "kimai") continue;
    const kv = {};
    for (const f of fields.slice(1)) {
      const idx = f.indexOf("=");
      if (idx === -1) continue;
      kv[f.slice(0, idx)] = f.slice(idx + 1);
    }
    if (kv.version && kv.source) {
      return `Kimai ${kv.version} /api/doc apiDescriptionDocument (${kv.source})`;
    }
  }
  throw new Error(
    `No usable "kimai version=... source=..." header line found in _source/SPEC-SOURCES.txt`,
  );
}
const generatedFrom = readGeneratedFrom();

// --- derived-field helpers ---

function titleCase(seg) {
  return seg.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// First path segment after the /api prefix, e.g. /api/timesheets/{id} -> "timesheets".
function resourceOf(path, apiPrefix) {
  const rest = path.startsWith(apiPrefix) ? path.slice(apiPrefix.length) : path;
  const seg = rest.replace(/^\/+/, "").split("/")[0];
  return seg || "root";
}

function categoryOf(raw, resource) {
  const tag = Array.isArray(raw.tags) && raw.tags.length > 0 ? raw.tags[0] : null;
  return tag && String(tag).trim() ? tag : titleCase(resource);
}

function nameOf(raw, method, path) {
  return raw.summary && String(raw.summary).trim() ? raw.summary : `${method} ${path}`;
}

function descriptionOf(raw) {
  if (raw.description && String(raw.description).trim()) return raw.description;
  if (raw.summary && String(raw.summary).trim()) return raw.summary;
  return "";
}

// Carried over from arr's CONTRACT.md section 4 unchanged. Under Kimai this classifies the
// 18 DELETEs plus nothing else: no Kimai path contains a destructive verb segment, and the
// three POST .../team endpoints that would have matched "bulk"-style naming are excluded
// entirely by the REMOVED rule below. The regex is kept anyway so both catalogs answer
// "what counts as destructive" the same way.
const DESTRUCTIVE_PATH = /(\/|^)(delete|remove|reset|restart|shutdown|wipe|purge|clear|bulk)(\/|$)/i;
function isDestructive(method, path) {
  if (method === "DELETE") return true;
  if (method === "GET") return false;
  return DESTRUCTIVE_PATH.test(path);
}

// One line, no real credentials. "{...}" is a literal placeholder, not a filled example body.
function buildRequestSample(method, path, bodySchema) {
  const parts = [
    `curl -X ${method} '${META.defaultBaseUrl}${path}'`,
    `-H 'Authorization: Bearer $KIMAI_API_TOKEN'`,
  ];
  if (bodySchema !== null) {
    parts.push(`-H 'Content-Type: application/json'`);
    parts.push(`-d '{...}'`);
  }
  return parts.join(" ");
}

/**
 * Exclusion rule: DESCRIPTION PREFIX, NOT THE DEPRECATED FLAG.
 *
 * This distinction is load-bearing and getting it wrong breaks the server in one direction
 * or lies to callers in the other. Kimai 2.65.0 marks four operations deprecated: true, and
 * they are two different kinds of thing.
 *
 *   GET /api/tags                 deprecated: true, description: ""
 *       Still works. Still returns every tag. v0.2.0's kimai_list_tags calls it and the
 *       curated tools retained in v0.3.0 still do. Excluding on the deprecated flag would
 *       delete a working endpoint that the server actively depends on.
 *
 *   POST /api/activities/{id}/team    deprecated: true, description: "REMOVED: ..."
 *   POST /api/customers/{id}/team     deprecated: true, description: "REMOVED: ..."
 *   POST /api/projects/{id}/team      deprecated: true, description: "REMOVED: ..."
 *       Gone. These return HTTP 410 Gone on a live instance; the replacement is
 *       POST /api/teams/. Keeping them would advertise three endpoints in list_endpoints
 *       that can only ever fail, which is worse than not listing them, because a model that
 *       sees them in the catalog will try one and then have to recover.
 *
 * So the rule keys off the "REMOVED:" description prefix that Kimai's own authors use to
 * mark tombstones, and deprecated: true alone is preserved and surfaced rather than acted
 * on. If a future Kimai version tombstones an endpoint without that prefix it will be
 * carried into the catalog; the deprecated count printed at the end of a run is there so
 * that shows up as a number worth checking rather than passing silently.
 */
function isTombstone(raw) {
  const desc = String(raw.description ?? "").trimStart();
  return desc.toUpperCase().startsWith("REMOVED:");
}

// --- build ---

// Stale entries must never survive a regeneration, so endpoints/ is wiped and rebuilt every
// run. enrichment/ is hand authored and must persist across regenerations, so it is only
// ever created, never cleared.
rmSync(endpointsOut, { recursive: true, force: true });
mkdirSync(endpointsOut, { recursive: true });
mkdirSync(enrichmentOut, { recursive: true });
const gitkeep = join(enrichmentOut, ".gitkeep");
if (!existsSync(gitkeep)) writeFileSync(gitkeep, "");

const files = readdirSync(rawDir).filter((f) => f.endsWith(".json"));
const indexEntries = [];
const problems = [];
const excluded = [];
let deprecatedKept = 0;
let pluginCount = 0;

for (const f of files) {
  const raw = JSON.parse(readFileSync(join(rawDir, f), "utf8"));
  const operationId = f.replace(/\.json$/, "");
  if (raw.operationId !== operationId) {
    problems.push(`${operationId}: operationId mismatch (${raw.operationId})`);
  }

  if (isTombstone(raw)) {
    excluded.push(`${operationId} (${raw.method} ${raw.path})`);
    continue;
  }
  if (raw.deprecated === true) deprecatedKept++;
  if (raw.pluginOnly === true) pluginCount++;

  const method = raw.method;
  const path = raw.path;
  const resource = resourceOf(path, META.apiPrefix);
  const bodySchema = raw.bodySchema ?? null;

  const spec = {
    operationId,
    resource,
    category: categoryOf(raw, resource),
    name: nameOf(raw, method, path),
    method,
    path,
    description: descriptionOf(raw),
    writeOperation: method !== "GET",
    destructive: isDestructive(method, path),
    paramLocation: bodySchema !== null ? "body" : "query",
    pathParams: raw.pathParams ?? [],
    params: raw.params ?? [],
    bodySchema,
    bodyContentType: raw.bodyContentType ?? null,
    responses: raw.responses ?? {},
    requestSample: buildRequestSample(method, path, bodySchema),
  };
  // Only set when true, so 88 of 91 entries stay free of two false flags.
  if (raw.deprecated === true) spec.deprecated = true;
  if (raw.pluginOnly === true) spec.pluginOnly = true;

  // Sanity check: every {placeholder} in the path should have a matching pathParams entry.
  // The extractor owns producing these; this only catches an extractor/assembler mismatch.
  const placeholders = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  for (const ph of placeholders) {
    if (!spec.pathParams.some((p) => p.name === ph)) {
      problems.push(`${operationId}: path placeholder {${ph}} has no pathParam`);
    }
  }

  writeFileSync(join(endpointsOut, `${operationId}.json`), JSON.stringify(spec, null, 2) + "\n");

  const entry = {
    operationId,
    resource: spec.resource,
    category: spec.category,
    name: spec.name,
    method: spec.method,
    path: spec.path,
    description: spec.description,
    writeOperation: spec.writeOperation,
    destructive: spec.destructive,
  };
  if (spec.pluginOnly) entry.pluginOnly = true;
  indexEntries.push(entry);
}

indexEntries.sort(
  (a, b) =>
    a.category.localeCompare(b.category) ||
    a.path.localeCompare(b.path) ||
    a.method.localeCompare(b.method),
);

const categories = [...new Set(indexEntries.map((e) => e.category))].sort();
const index = {
  product: META.product,
  generatedFrom,
  apiPrefix: META.apiPrefix,
  defaultBaseUrl: META.defaultBaseUrl,
  authScheme: META.authScheme,
  endpointCount: indexEntries.length,
  readCount: indexEntries.filter((e) => !e.writeOperation).length,
  writeCount: indexEntries.filter((e) => e.writeOperation).length,
  destructiveCount: indexEntries.filter((e) => e.destructive).length,
  categories,
  endpoints: indexEntries,
};

writeFileSync(join(outDir, "index.json"), JSON.stringify(index, null, 2) + "\n");

// Orphaned enrichment check. Enrichment files are keyed by operationId, and this catalog
// uses Kimai's OWN operationIds rather than ids synthesized from method + path. That makes
// them upstream's to rename: a Kimai release that renames an operation silently detaches any
// enrichment written against the old id, and nothing else in the build would notice, because
// enrichment/ is deliberately never cleared. Reported as a problem so the detachment is
// visible at the moment it happens rather than as quietly missing guidance months later.
const known = new Set(indexEntries.map((e) => e.operationId));
for (const f of readdirSync(enrichmentOut).filter((x) => x.endsWith(".json"))) {
  const id = f.replace(/\.json$/, "");
  if (!known.has(id)) {
    problems.push(`enrichment/${f}: no endpoint with operationId "${id}" (renamed upstream?)`);
  }
}

// --- report ---
const byCat = {};
for (const e of indexEntries) byCat[e.category] = (byCat[e.category] || 0) + 1;
console.log(`product:       ${META.product}`);
console.log(`generatedFrom: ${generatedFrom}`);
console.log(`endpoints:     ${index.endpointCount}  (read ${index.readCount} / write ${index.writeCount})`);
console.log(`destructive:   ${index.destructiveCount}`);
console.log(`plugin-only:   ${pluginCount}`);
console.log(`deprecated:    ${deprecatedKept} kept (functional), ${excluded.length} excluded as REMOVED`);
for (const e of excluded) console.log(`  - excluded ${e}`);
console.log(`categories:    ${JSON.stringify(byCat)}`);
console.log(`problems:      ${problems.length}`);
for (const p of problems.slice(0, 20)) console.log(`  - ${p}`);
if (problems.length > 20) console.log(`  ... and ${problems.length - 20} more`);
console.log(`wrote -> src/catalog-kimai/endpoints/ + index.json`);
if (problems.length) process.exitCode = 1;
