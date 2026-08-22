# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
