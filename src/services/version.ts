/**
 * Runtime detection of the connected Kimai's version, and the gate that uses it.
 *
 * WHY THIS EXISTS
 * ---------------
 * Kimai is self-hosted, so the catalog this server ships and the instance it
 * is pointed at are two independently moving versions. The catalog is built
 * from one vendored spec plus hand-authored entries, and it is always at least
 * as new as the oldest instance someone might run it against. Without a gate,
 * an operator on an older Kimai sees an endpoint in kimai_list_endpoints,
 * calls it, and gets a bare 404 that is indistinguishable from "the catalog is
 * wrong" or "you typed the path wrong". The version is the missing piece of
 * context that turns that 404 into a sentence the caller can act on.
 *
 * This only solves instance-OLDER-than-catalog. The reverse -- an instance
 * NEWER than the catalog, whose endpoints are simply absent here -- is not
 * detectable from version metadata and is fixed only by regenerating the
 * catalog. See _source/SPEC-SOURCES.txt.
 *
 * WHY versionId AND NOT SEMVER
 * ----------------------------
 * GET /api/version returns both a display string ("2.67.0") and versionId
 * (26700), an integer Kimai computes as major*10000 + minor*100 + patch. It is
 * already monotonic and already comparable, so the gate does integer math and
 * never parses semver. parseVersionId below exists only as a fallback for
 * instances old enough to omit the field, and for the KIMAI_VERSION override.
 *
 * THIS GATE FAILS OPEN, DELIBERATELY
 * ----------------------------------
 * Every unknown resolves to "allow". If /api/version is unreachable, returns a
 * shape we do not recognise, or is blocked by a reverse proxy, the gate is
 * skipped entirely and behaviour is exactly what it was before this file
 * existed: the call goes out and Kimai answers for itself. Failing closed
 * would let one unreadable probe disable a catalog that works, which is a
 * strictly worse failure than the 404 this is trying to explain.
 */
import type { EndpointSpec } from "../catalog/endpoint-spec.js";
import { ENV } from "../constants.js";
import type { KimaiClient } from "./kimai-client.js";

export interface KimaiVersion {
  /** Display form, e.g. "2.67.0". */
  version: string;
  /** major*10000 + minor*100 + patch, e.g. 26700. Comparable with <. */
  versionId: number;
  /** Where the value came from, so diagnostics can say so. */
  source: "probe" | "override";
}

/** Shape of GET /api/version. versionId is absent on older Kimai. */
interface VersionResponse {
  version?: unknown;
  versionId?: unknown;
}

/**
 * "2.67.0" -> 26700. Returns null for anything that is not major.minor[.patch].
 * Kimai's own formula, reproduced so the override env var and pre-versionId
 * instances land on the same scale as the server-reported integer.
 */
export function parseVersionId(version: string): number | null {
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(version.trim());
  if (!match) return null;
  const [, major, minor, patch] = match;
  return Number(major) * 10_000 + Number(minor) * 100 + Number(patch ?? 0);
}

/** 26700 -> "2.67.0". The inverse of parseVersionId, for error text. */
export function formatVersionId(versionId: number): string {
  const major = Math.floor(versionId / 10_000);
  const minor = Math.floor((versionId % 10_000) / 100);
  const patch = versionId % 100;
  return `${major}.${minor}.${patch}`;
}

/**
 * Cached across the process. MCP servers are long-lived stdio processes and a
 * running Kimai does not change version underneath one, so this probes once.
 * The PROMISE is cached rather than the value so that concurrent first calls
 * share a single request instead of racing several.
 *
 * A failed probe caches null and is not retried. That is intentional: a retry
 * on every catalog call would put an extra request in front of each one to buy
 * back a gate that is only advisory.
 */
let cachedVersion: Promise<KimaiVersion | null> | null = null;

/** Test seam. Not called in normal operation. */
export function resetVersionCache(): void {
  cachedVersion = null;
}

export function resolveInstanceVersion(client: KimaiClient): Promise<KimaiVersion | null> {
  if (!cachedVersion) cachedVersion = detect(client);
  return cachedVersion;
}

async function detect(client: KimaiClient): Promise<KimaiVersion | null> {
  // An explicit override wins and skips the network entirely. It exists for
  // forks, reverse proxies that shadow /api/version, and for pinning the gate
  // in a test. A value we cannot parse is ignored rather than fatal -- this is
  // an advisory gate and must never be the reason the server fails to serve.
  const override = process.env[ENV.kimaiVersion]?.trim();
  if (override) {
    const versionId = parseVersionId(override);
    if (versionId !== null) {
      return { version: override, versionId, source: "override" };
    }
  }

  try {
    const { data } = await client.get<VersionResponse>("/api/version");

    const versionId =
      typeof data?.versionId === "number"
        ? data.versionId
        : typeof data?.version === "string"
          ? parseVersionId(data.version)
          : null;
    if (versionId === null) return null;

    const version = typeof data?.version === "string" ? data.version : formatVersionId(versionId);
    return { version, versionId, source: "probe" };
  } catch {
    // Unreachable, unauthorized, proxied away, or any other failure. Fail open.
    return null;
  }
}

/**
 * The gate itself. Returns a refusal string when the connected instance is too
 * old for this operation, or null when the call should proceed.
 *
 * Both unknowns resolve to null (proceed): an endpoint with no sinceVersion is
 * assumed to predate the catalog baseline, and an instance whose version could
 * not be determined is given the benefit of the doubt.
 */
export function checkVersionRequirement(
  spec: Pick<EndpointSpec, "operationId" | "method" | "path" | "sinceVersion">,
  instance: KimaiVersion | null
): string | null {
  if (spec.sinceVersion === undefined) return null;
  if (instance === null) return null;
  if (instance.versionId >= spec.sinceVersion) return null;

  const required = formatVersionId(spec.sinceVersion);
  const detected =
    instance.source === "override"
      ? `${instance.version} (from ${ENV.kimaiVersion})`
      : instance.version;

  return (
    `"${spec.operationId}" (${spec.method} ${spec.path}) requires Kimai ${required} or newer. ` +
    `The connected instance reports ${detected}, so this endpoint does not exist there and the ` +
    `call would 404. No request was sent. Upgrade Kimai to ${required}+ to use it, or set ` +
    `${ENV.kimaiVersion} if this instance reports its version incorrectly.`
  );
}
