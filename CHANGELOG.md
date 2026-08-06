# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
