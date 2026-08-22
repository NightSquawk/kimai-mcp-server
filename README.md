# Kimai MCP Server

[![npm version](https://img.shields.io/npm/v/@nightsquawktech/kimai-mcp-server)](https://www.npmjs.com/package/@nightsquawktech/kimai-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@nightsquawktech/kimai-mcp-server)](https://www.npmjs.com/package/@nightsquawktech/kimai-mcp-server)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/NightSquawk/kimai-mcp-server/badge)](https://scorecard.dev/viewer/?uri=github.com/NightSquawk/kimai-mcp-server)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](https://github.com/NightSquawk/kimai-mcp-server/blob/v1.0.0/LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

An MCP (Model Context Protocol) server for **Kimai**, connecting your self-hosted time tracking to AI tools.

16 tools cover the entire Kimai API. 13 are curated tools over the surface you use every day (timesheets, plus the lookups a timesheet write needs); the other 3 are a generic catalog of all 91 API endpoints for everything else. See [Tools](#tools).

## Quick start

### Claude

[![Download for Claude Desktop](https://img.shields.io/badge/Claude_Desktop-Download_.mcpb-D97757?style=flat-square)](https://github.com/NightSquawk/kimai-mcp-server/releases/download/mcpb-v0.1.0/kimai-mcp-server-0.1.0.mcpb)

**bash (macOS/Linux):**

```bash
KIMAI_BASE_URL="https://example.kimai.cloud"
KIMAI_API_TOKEN="replace-with-api-token"

claude mcp add kimai \
  --env KIMAI_BASE_URL="$KIMAI_BASE_URL" \
  --env KIMAI_API_TOKEN="$KIMAI_API_TOKEN" \
  -- npx -y @nightsquawktech/kimai-mcp-server
```

**PowerShell (Windows):**

```powershell
$KIMAI_BASE_URL = "https://example.kimai.cloud"
$KIMAI_API_TOKEN = "replace-with-api-token"

claude mcp add kimai `
  --env "KIMAI_BASE_URL=$KIMAI_BASE_URL" `
  --env "KIMAI_API_TOKEN=$KIMAI_API_TOKEN" `
  -- npx -y @nightsquawktech/kimai-mcp-server
```

### Cursor

[![Add to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=kimai&config=eyJjb21tYW5kIjogIm5weCIsICJhcmdzIjogWyIteSIsICJAbmlnaHRzcXVhd2t0ZWNoL2tpbWFpLW1jcC1zZXJ2ZXIiXSwgImVudiI6IHsiS0lNQUlfQkFTRV9VUkwiOiAiaHR0cHM6Ly9leGFtcGxlLmtpbWFpLmNsb3VkIiwgIktJTUFJX0FQSV9UT0tFTiI6ICJyZXBsYWNlLXdpdGgtYXBpLXRva2VuIiwgIktJTUFJX1RJTUVPVVRfTVMiOiAiMzAwMDAifX0%3D)

Or put the [mcp.json](#mcpjson) block in `.cursor/mcp.json`, then verify with:

```bash
agent mcp list
```

(The Cursor CLI manages configured servers but has no `mcp add`; install is via the button or `mcp.json`.)

### VS Code

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=kimai&config=%7B%22command%22%3A%20%22npx%22%2C%20%22args%22%3A%20%5B%22-y%22%2C%20%22%40nightsquawktech/kimai-mcp-server%22%5D%2C%20%22env%22%3A%20%7B%22KIMAI_BASE_URL%22%3A%20%22https%3A//example.kimai.cloud%22%2C%20%22KIMAI_API_TOKEN%22%3A%20%22replace-with-api-token%22%2C%20%22KIMAI_TIMEOUT_MS%22%3A%20%2230000%22%7D%7D)

**bash (macOS/Linux):**

```bash
KIMAI_BASE_URL="https://example.kimai.cloud"
KIMAI_API_TOKEN="replace-with-api-token"

code --add-mcp '{"name":"kimai","command":"npx","args":["-y","@nightsquawktech/kimai-mcp-server"],"env":{"KIMAI_BASE_URL":"'"$KIMAI_BASE_URL"'","KIMAI_API_TOKEN":"'"$KIMAI_API_TOKEN"'"}}'
```

**PowerShell (Windows):**

```powershell
$KIMAI_BASE_URL = "https://example.kimai.cloud"
$KIMAI_API_TOKEN = "replace-with-api-token"

$config = @{
  name = "kimai"
  command = "npx"
  args = @("-y", "@nightsquawktech/kimai-mcp-server")
  env = @{
    KIMAI_BASE_URL = $KIMAI_BASE_URL
    KIMAI_API_TOKEN = $KIMAI_API_TOKEN
  }
} | ConvertTo-Json -Compress

code --add-mcp $config
```

### Codex

**bash (macOS/Linux):**

```bash
KIMAI_BASE_URL="https://example.kimai.cloud"
KIMAI_API_TOKEN="replace-with-api-token"

codex mcp add kimai \
  --env KIMAI_BASE_URL="$KIMAI_BASE_URL" \
  --env KIMAI_API_TOKEN="$KIMAI_API_TOKEN" \
  -- npx -y @nightsquawktech/kimai-mcp-server
```

**PowerShell (Windows):**

```powershell
$KIMAI_BASE_URL = "https://example.kimai.cloud"
$KIMAI_API_TOKEN = "replace-with-api-token"

codex mcp add kimai `
  --env "KIMAI_BASE_URL=$KIMAI_BASE_URL" `
  --env "KIMAI_API_TOKEN=$KIMAI_API_TOKEN" `
  -- npx -y @nightsquawktech/kimai-mcp-server
```

Or add it to `~/.codex/config.toml` under `[mcp_servers.kimai]`.

### mcp.json

Every environment variable the server reads, with recommended values:

```json
{
  "mcpServers": {
    "kimai": {
      "command": "npx",
      "args": ["-y", "@nightsquawktech/kimai-mcp-server"],
      "env": {
        "KIMAI_BASE_URL": "https://example.kimai.cloud",
        "KIMAI_API_TOKEN": "replace-with-api-token",
        "KIMAI_TIMEOUT_MS": "30000"
      }
    }
  }
}
```

File locations: `.mcp.json` in your project root (Claude Code), `claude_desktop_config.json` (Claude Desktop), `.cursor/mcp.json` (Cursor).

## Configuration

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `KIMAI_BASE_URL` | yes | | Your Kimai URL without a trailing slash, e.g. `https://example.kimai.cloud` |
| `KIMAI_API_TOKEN` | yes | | API token generated in your Kimai user profile (API Access) |
| `KIMAI_TIMEOUT_MS` | no | `30000` | HTTP timeout for Kimai API requests, minimum 1000 |
| `KIMAI_ALLOW_DELETE` | no | `false` | Set to `true` to allow deletes. While unset or `false`, every delete refuses before contacting Kimai, whether it is attempted through `kimai_delete_timesheet` or through `kimai_call_endpoint`. Accepts `true/false/1/0/yes/no/on/off`; any other value fails at startup rather than defaulting to off. |

## Security & write safety

Kimai credentials: generate an API token in your Kimai user profile. The token inherits that user's permissions, so use a dedicated Kimai user with the smallest role that covers what you need. A token belonging to a `ROLE_SUPER_ADMIN` account can reach every tool below, including the cascading deletes.

Protection is applied per **operation**, not per tool, so routing a call through the generic `kimai_call_endpoint` gets exactly the same treatment as the equivalent curated tool. There is no path through this server that reaches a write or a delete with fewer checks.

- **Reads.** GET requests only. They cannot change anything in Kimai and run without any gate.
- **Writes** (create, update, stop, toggle, assign). Each call requires `authorization_confirmed: true` and an `authorization_note` of 8 characters or more recording the user's approval, and each writes a JSON backup of the prior record, the request, and the result to `kimai-mcp-backups` in the OS temp directory.
- **Deletes.** Everything writes require, plus `KIMAI_ALLOW_DELETE=true`. The gate is checked before any network call, so a server that never opted in cannot be talked into a delete.

### Cascading deletes

Three deletes destroy more than the record you name. Kimai's own API documentation calls this out: deleting a customer "will also delete ALL linked projects, project activities and timesheets".

| Operation | Also deletes |
|---|---|
| `delete_customer` | Every project, activity, and timesheet under that customer |
| `delete_project` | Every activity and timesheet under that project |
| `delete_activity` | Every timesheet booked against that activity |

Before any of these runs, the server snapshots the dependent records into the backup file, paging through the affected timesheets with `user=all` so another user's entries are not silently omitted. If the snapshot cannot be written, the delete does not happen. To retire a customer without destroying its billing history, `PATCH` it with `visible: false` instead.

> [!IMPORTANT]
> The authorization fields and the environment gate are guardrails, not a security boundary. The env vars in your MCP config are real credentials, and an agent with shell access can bypass these tools and call the Kimai API directly. If you need a hard limit, enforce it at the source: give the token's Kimai user a role without delete permissions.

## Tools

16 tools, in two groups.

### Curated (13)

Hand-written tools over the surface that gets used constantly, and where Kimai's
filter behaviour is easy to get wrong. Their parameter descriptions carry the
warnings in [Notes on Kimai's API](#notes-on-kimais-api), which is the reason
they exist as named tools rather than as catalog entries.

```
kimai_get_current_user          The user behind the API token
kimai_list_customers            List customers
kimai_list_projects             List projects, filtered by customer or date range
kimai_list_activities           List activities, filtered by project or globals-only
kimai_list_tags                 Search tags by name, or list every tag name
kimai_list_timesheets           List timesheets with the full Kimai filter set
kimai_get_timesheet             Get one timesheet entry
kimai_list_active_timesheets    Currently running timesheets
kimai_list_recent_timesheets    Recent timesheet entries
kimai_create_timesheet          Create an entry                 (write)
kimai_update_timesheet          Correct an entry                (write)
kimai_stop_timesheet            Stop a running entry            (write)
kimai_delete_timesheet          Delete an entry                 (delete)
```

### Catalog (3)

Everything else in the Kimai API, through three generic tools backed by a
generated catalog of all 91 endpoints. Customers, projects, activities, teams,
tags, users, invoices, rates, comments, meta fields, and the plugin endpoints
are all created, updated, and deleted through here.

```
kimai_list_endpoints            Find an endpoint by category, resource, method, or search
kimai_describe_endpoint         Full spec for one endpoint: params, patterns, body schema
kimai_call_endpoint             Execute it, under the same guards as the curated tools
```

The usual sequence is list, describe, call:

```
kimai_list_endpoints    { "search": "invoice" }
kimai_describe_endpoint { "operation_id": "get_invoices" }
kimai_call_endpoint     { "operation_id": "get_invoices", "params": { "begin": "2026-08-01T00:00:00" } }
```

`kimai_call_endpoint` does not pass parameters through blindly. Kimai discards
query filters it does not understand instead of rejecting them, so a malformed
filter returns a `200` with the wrong rows. The tool refuses a comma-separated
array filter and tells you the correct array, converts booleans to the `0|1`
form Kimai expects, and warns when a timesheet read omits `user` (which
otherwise silently covers one person instead of the team).

### Why the split

A tool costs context whether or not it is called: every tool's full schema sits
in the model's context for the entire session. One tool per endpoint would be 91
tools and roughly 25,000 tokens of standing overhead. Three catalog tools cost
about 700. The 13 curated tools are the ones worth paying for individually,
because their schema descriptions prevent measured, silent failures that a
generic endpoint listing cannot describe.

Measured `tools/list` payload: **25,563 bytes across 16 tools**, down from 99,802
bytes across 66 in 0.2.0.

## API coverage

**All 85 live endpoints** in the Kimai 2.65.0 core API, plus 6 plugin endpoints.

| Controller | Covered | Live |
|---|---|---|
| Status & configuration | 5 | 5 |
| Users | 7 | 7 |
| Customers | 13 | 13 |
| Projects | 13 | 13 |
| Activities | 9 | 9 |
| Timesheets | 12 | 12 |
| Teams | 13 | 13 |
| Tags | 4 | 4 |
| Invoices | 4 | 4 |
| Export | 1 | 1 |
| Actions | 4 | 4 |
| **Total** | **85** | **85** |

The `/api/actions/*` endpoints return UI menu links for Kimai's own web
interface. 0.2.0 skipped them deliberately; the catalog carries them because
excluding four endpoints from a generated index costs more to explain than to
include.

Kimai's route table has 88 entries. The other three (`POST /api/customers/{id}/team`,
and the same on projects and activities) were removed upstream and answer
`410 Gone`, so the catalog excludes them rather than advertising endpoints that
can only fail. Grant team access through `POST /api/teams/` instead.

Plugin endpoints covered: expenses (2), tasks (2), absences (1), public holidays
(1). These are absent from Kimai's open-source API documentation, so their
catalog entries are hand-authored and marked `plugin_only`; they return a normal
Kimai `404` when the matching plugin is not installed.

### Regenerating the catalog

The catalog is generated from a vendored OpenAPI document and committed, so a
normal install needs none of this. To rebuild it against a newer Kimai:

```bash
# drop the new spec in _source/kimai-<version>-openapi.json first
# (_source/SPEC-SOURCES.txt documents how to produce one)
npm run regen
npm run build
```

`_source/plugin-endpoints.json` holds the hand-authored plugin entries and
`src/catalog-kimai/enrichment/` holds hand-written usage notes. Both survive
regeneration; only `src/catalog-kimai/endpoints/` is rebuilt.

## Notes on Kimai's API

Behaviors that are easy to get wrong, all verified against a live 2.65.0 instance:

- **Timesheets default to the token owner.** `kimai_list_timesheets` returns only your own entries unless you pass `user: "all"`, which needs the `view_other_timesheet` permission. This is the most common cause of an undercounted total, and `kimai_call_endpoint` warns when you omit it.
- **Tag filters must be exact.** Kimai answers HTTP 400, not an empty result, when a tag name does not exist. Check spelling with `kimai_list_tags`.
- **Boolean filters are `0|1` on the wire.** `exported`, `active`, and `billable` are booleans on the tool surface and are converted before the request; sending `true` directly to Kimai does not filter as expected.
- **Repeatable filters must be repeated, not comma-joined.** `tags[]=a&tags[]=b` filters correctly; `tags=a,b` is accepted and then ignored, returning unfiltered rows with a `200`. Measured: the comma form returned 500 of 500 rows. `kimai_call_endpoint` refuses that form rather than passing it through.
- **Four endpoints do not paginate.** `/api/teams`, `/api/timesheets/active`, `/api/tags`, and the rates and comments sub-resources return everything at once, and the tools report a plain count instead of a page number.
- **`/api/tags/find` needs a search term.** Called bare it returns an empty list rather than every tag, so `kimai_list_tags` falls back to `/api/tags` when no name is given.
- **Kimai drops unknown filters silently.** A misspelled filter name is not an error; it just widens your result set. `kimai_call_endpoint` warns about any parameter an endpoint does not declare.
