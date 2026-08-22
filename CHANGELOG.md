# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-08-21

Kimai's whole API is now reachable, and the tool list got 76% smaller. Those
are the same change: the 50 curated tools that existed only to cover an
endpoint were replaced by a generated catalog of all 91, and the 13 whose
schema descriptions prevent real, measured failures were kept.

### Added

- **Three catalog tools** -- `kimai_list_endpoints`, `kimai_describe_endpoint`,
  and `kimai_call_endpoint` -- backed by a generated catalog of every Kimai
  endpoint. Coverage goes from 81 of 85 live core endpoints to all 85, plus the
  6 plugin endpoints. The four `/api/actions/*` endpoints 0.2.0 skipped are now
  included.
- **Parameter checking on `kimai_call_endpoint`.** Kimai discards query filters
  it does not understand instead of rejecting them, so a malformed filter
  returns a `200` with the wrong rows. A comma-separated array filter is now
  refused with the correct array spelled out (measured: `tags` as `"bar,foo"`
  returned 500 of 500 rows unfiltered), booleans are converted to the `0|1`
  form, the `visible`/`hidden`/`all` words are mapped to `1|2|3`, and a
  parameter an endpoint does not declare produces a warning rather than a
  silently wider result set. A timesheet read that omits `user` warns that it
  covers only the token owner.
- **An enrichment layer** at `src/catalog-kimai/enrichment/`, carrying
  hand-written guidance that no OpenAPI document contains: the cascade
  consequences of the three destructive deletes, the `/api/tags/find`
  empty-result trap, and the timesheet filter behaviour. It survives catalog
  regeneration, and the assembler reports enrichment whose operation no longer
  exists.
- **A two-stage catalog pipeline** (`npm run regen`) ported from
  arr-mcp-server, plus `scripts/smoke-test.mjs`, which asserts the whole
  safety chain over real MCP stdio against a closed port, where an escaped
  request fails loudly instead of passing quietly.

### Changed

- **66 tools became 16** (13 curated + 3 catalog). The `tools/list` payload
  went from 99,802 bytes to 25,563, roughly 25,000 standing tokens to 6,400.
  A tool costs context whether or not it is ever called, which is what made
  one-tool-per-endpoint the wrong shape at this API's size.
- **Protection is now per operation, not per tool.** A write or delete routed
  through `kimai_call_endpoint` gets the same authorization fields, the same
  `KIMAI_ALLOW_DELETE` gate, the same backup, and the same cascade snapshots as
  the equivalent curated tool did. The generic path is not a way around the
  guards.
- `KIMAI_ALLOW_DELETE` now gates deletes on both paths. Its refusal message no
  longer claims the gate is checked before the per-call authorization fields,
  because `kimai_call_endpoint` deliberately checks it after them so that the
  blocker a human has to clear is the one a caller ends on. Both still check it
  before any network call, which is the guarantee that matters.

### Removed

- **50 curated tools**, all still reachable through `kimai_call_endpoint`:
  every customer, project, activity, team, tag, user, invoice, rate, comment,
  meta field, and plugin tool, plus `kimai_restart_timesheet`,
  `kimai_duplicate_timesheet`, `kimai_toggle_timesheet_export`,
  `kimai_get_server_info`, and the single-entity `get` tools whose list
  equivalents were kept.
- Three endpoints Kimai removed upstream (`POST /api/customers/{id}/team` and
  the same on projects and activities) are excluded from the catalog rather
  than advertised. They answer `410 Gone`. Grant team access through
  `POST /api/teams/`.

### Kept

The 13 curated tools are the ones whose value is in their schema descriptions
rather than in their existence: all four timesheet reads, timesheet
create/update/stop/delete, `kimai_list_customers`, `kimai_list_projects`,
`kimai_list_activities`, `kimai_list_tags`, and `kimai_get_current_user`.

## [0.2.0] - 2026-08-22

### Added

- **`kimai_delete_timesheet` and 10 further delete tools**, behind a new
  `KIMAI_ALLOW_DELETE` environment gate that defaults to off. The gate is
  checked before the per-call authorization fields and before any network call,
  so a server that never opted in cannot be talked into a delete. An
  unrecognized value for the variable fails at startup instead of silently
  defaulting to off.
- **Cascade snapshots for the three destructive deletes.** Kimai documents
  `DELETE /api/customers/{id}` as also deleting every linked project, activity,
  and timesheet, and project and activity deletes behave the same way. Those
  tools now page through the affected timesheets with `user=all` and write them
  into the backup file before the delete is sent. If the snapshot cannot be
  written, the delete does not happen.
- **Full write coverage for master data**: create/update/delete for customers,
  projects, activities, teams, and tags; create/update for users; user
  preferences; meta fields; rates; comments and comment pinning; team
  assignment; invoice custom fields; export template deletion.
- **New read tools**: `kimai_list_rates`, `kimai_list_comments`,
  `kimai_list_absences`, `kimai_list_public_holidays`, and
  `kimai_download_invoice`. `kimai_get_server_info` now also reports
  `/api/config/colors`.
- **Missing query filters on existing read tools**: timesheets gained
  `users`, `customers`, `projects`, `activities`, `billable`, `full`, `term`,
  `modified_after`, `order_by`, and `order`; projects gained date-range and
  `customers` filters; activities gained `globals` and `projects`; users gained
  visibility, search, and sort; customers gained `full`.
- Server identity, construction, and the stdio handoff now come from
  `@nightsquawktech/mcp-core`. The catalog primitives in that package are not
  used: this server keeps named, curated tools.

### Fixed

- **`exported` and `active` timesheet filters returned HTTP 400 on every call.**
  Both are declared `requirements: '0|1'` by Kimai, but the tool forwarded the
  JSON booleans that axios serializes as `exported=true`. This is the same
  defect class as the `visible` enum fixed in 0.1.1 and was missed by that pass.
  The tool-facing booleans are unchanged; the values are now translated in the
  query layer, along with the new `billable`, `full`, `globals`, and
  `ignore_dates` filters.
- **The `tags` timesheet filter was silently ignored.** Tags were comma-joined
  into `tags=a,b`, but Kimai declares the parameter `map: true` and expects
  `tags[]=a&tags[]=b`. Kimai does not reject the scalar form, it discards it:
  measured on a 500-row window, `tags=<existing tag>` returned all 500 rows
  while `tags[]=<existing tag>` returned 0. Any report filtered by tag was
  therefore computed over unfiltered data. Note that Kimai answers HTTP 400,
  not an empty result, for a tag name that does not exist.
- **`kimai_list_tags` returned nothing when called without a name.** It was
  backed by `/api/tags/find`, whose handler only queries when a name is
  supplied. It now falls back to `/api/tags` and lists every tag name.
- **`kimai_list_invoices` sent filters that do not exist and omitted the ones
  that do.** It passed `term`, `orderBy`, and `order`, none of which are
  declared on `GET /api/invoices`, and exposed none of `begin`, `end`,
  `customers`, or `status`. All four real filters are now available.
- **`user: "all"` was undocumented.** Kimai's timesheet endpoint defaults to the
  API token owner alone, so any team-wide total computed without it was short.
  The parameter description now states this.
- **Fabricated pagination on four endpoints.** `/api/teams`,
  `/api/timesheets/active`, `/api/tags`, and the new sub-resource endpoints
  accept no `page` or `size`, but the tools sent them and reported page numbers
  Kimai had never applied. Those tools now report a plain count.
- **`kimai_list_recent_timesheets` sent an unsupported `page`** and did not
  expose `begin`. `/api/timesheets/recent` accepts only `begin` and `size`.
- **Reported server version drifted from the package version.** `constants.ts`
  announced `0.1.0` over the MCP handshake while the package was `0.1.1`.

## [0.1.1] - 2026-08-06

### Fixed

- **`visible` filter returned HTTP 400 on every call.** `kimai_list_customers`,
  `kimai_list_projects`, and `kimai_list_activities` forwarded the schema's string
  enum (`visible` / `hidden` / `all`) directly to Kimai, which expects an integer
  (`1` = visible, `2` = hidden, `3` = all). The filter could never succeed, so
  hidden entities were unreachable through the server. The tool-facing enum is
  unchanged; the value is now translated in the query layer.
- Synced `package-lock.json` with the scoped package name
  (`@nightsquawktech/kimai-mcp-server`) and added the missing `license` field.
  The stale lockfile name could fail `npm ci` in the publish workflow.

### Added

- `language` and `currency` in `kimai_list_customers` and `kimai_get_customer`
  summaries.
- `invoiceEmail` in `kimai_get_customer` summaries. Note that Kimai serializes
  this field as camelCase `invoiceEmail`, not `invoice_email` as the 2026-08-04
  release notes state, and returns it only from `/api/customers/{id}` — not from
  the customer collection endpoint.

### Notes

Verified against Kimai 2.63.0 (Kimai Cloud). No changes were required for the
2026-08-04 release: Bearer authentication is already the migration target for the
retired API-password scheme, the server writes only timesheets (so the
customer/project/activity `POST` default-value change does not apply), and
pagination is read from response headers rather than CORS-exposed ones.

## [0.1.0] - 2026-07-12

### Added

- Initial release.

[0.1.1]: https://github.com/NightSquawk/kimai-mcp-server/releases/tag/v0.1.1
[0.1.0]: https://github.com/NightSquawk/kimai-mcp-server/releases/tag/v0.1.0
