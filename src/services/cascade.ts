import type { KimaiClient } from "./kimai-client.js";
import { extractItems } from "../tools/format.js";

/**
 * Capture the records a cascading Kimai delete is about to destroy.
 *
 * Kimai documents DELETE /api/customers/{id} as "[DANGER] This will also delete
 * ALL linked projects, project activities and timesheets", and project and
 * activity deletes take their timesheets with them the same way. Backing up
 * only the named entity would therefore preserve one row while silently losing
 * every hour ever booked against it, so the delete tools snapshot the
 * dependents first and refuse to proceed if the snapshot cannot be taken.
 *
 * The `user: "all"` below is load-bearing. Kimai's timesheet endpoint defaults
 * to the API token owner alone, so without it a cascade snapshot taken by one
 * account would quietly omit every other user's entries: exactly the rows most
 * likely to be irreplaceable.
 */

const PAGE_SIZE = 500;
const MAX_PAGES = 20;

export interface CascadeSnapshot {
  [key: string]: unknown;
  timesheets: unknown[];
  timesheet_count: number;
  truncated: boolean;
}

type TimesheetFilter = "customers" | "projects" | "activities";

export async function collectAffectedTimesheets(
  client: KimaiClient,
  filter: TimesheetFilter,
  id: string
): Promise<CascadeSnapshot> {
  const timesheets: unknown[] = [];
  let truncated = false;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let batch: unknown[];
    try {
      const response = await client.get<unknown>("/api/timesheets", {
        [filter]: [id],
        user: "all",
        page,
        size: PAGE_SIZE
      });
      batch = extractItems(response.data);
    } catch {
      // Kimai answers 404 for a page past the end of the result set, which is
      // the normal way this loop finishes when the total is an exact multiple
      // of PAGE_SIZE.
      break;
    }

    timesheets.push(...batch);
    if (batch.length < PAGE_SIZE) {
      return { timesheets, timesheet_count: timesheets.length, truncated: false };
    }

    if (page === MAX_PAGES) truncated = true;
  }

  return { timesheets, timesheet_count: timesheets.length, truncated };
}

/** Child entities that vanish with a customer or project. */
export async function collectChildren(
  client: KimaiClient,
  path: string,
  params: Record<string, unknown>
): Promise<unknown[]> {
  try {
    const response = await client.get<unknown>(path, { ...params, size: PAGE_SIZE });
    return extractItems(response.data);
  } catch {
    return [];
  }
}
