# Kimai MCP Server

[![npm version](https://img.shields.io/npm/v/@nightsquawktech/kimai-mcp-server)](https://www.npmjs.com/package/@nightsquawktech/kimai-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@nightsquawktech/kimai-mcp-server)](https://www.npmjs.com/package/@nightsquawktech/kimai-mcp-server)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/NightSquawk/kimai-mcp-server/badge)](https://scorecard.dev/viewer/?uri=github.com/NightSquawk/kimai-mcp-server)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](https://github.com/NightSquawk/kimai-mcp-server/blob/v1.0.0/LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

An MCP (Model Context Protocol) server for **Kimai**, connecting your self-hosted time tracking to AI tools.

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
| `KIMAI_ALLOW_DELETE` | no | `false` | Set to `true` to enable the 11 delete tools. While unset or `false`, every delete tool refuses before contacting Kimai. Accepts `true/false/1/0/yes/no/on/off`; any other value fails at startup rather than defaulting to off. |

## Security & write safety

Kimai credentials: generate an API token in your Kimai user profile. The token inherits that user's permissions, so use a dedicated Kimai user with the smallest role that covers what you need. A token belonging to a `ROLE_SUPER_ADMIN` account can reach every tool below, including the cascading deletes.

The server has three tiers, and a tool never moves down a tier without a code change:

- **28 read-only tools.** GET requests only. They cannot change anything in Kimai.
- **24 write tools** (create, update, stop, restart, duplicate, toggle, assign). Each call requires `authorization_confirmed: true` and an `authorization_note` of 8 characters or more recording the user's approval, and each writes a JSON backup of the prior record, the request, and the result to `kimai-mcp-backups` in the OS temp directory.
- **11 delete tools.** Everything the write tier requires, plus `KIMAI_ALLOW_DELETE=true`. The environment gate is checked first, before the per-call fields and before any network call, so a server that never opted in cannot be talked into a delete.

### Cascading deletes

Three deletes destroy more than the record you name. Kimai's own API documentation calls this out: deleting a customer "will also delete ALL linked projects, project activities and timesheets".

| Tool | Also deletes |
|---|---|
| `kimai_delete_customer` | Every project, activity, and timesheet under that customer |
| `kimai_delete_project` | Every activity and timesheet under that project |
| `kimai_delete_activity` | Every timesheet booked against that activity |

Before any of these runs, the server snapshots the dependent records into the backup file, paging through the affected timesheets with `user=all` so another user's entries are not silently omitted. If the snapshot cannot be written, the delete does not happen. To retire a customer without destroying its billing history, use `kimai_update_customer` with `visible: false` instead.

> [!IMPORTANT]
> The authorization fields and the environment gate are guardrails, not a security boundary. The env vars in your MCP config are real credentials, and an agent with shell access can bypass these tools and call the Kimai API directly. If you need a hard limit, enforce it at the source: give the token's Kimai user a role without delete permissions.

## Tools

63 tools. Read-only tools are safe to call at any time; write and delete tools require the guards described above.

### Read (28)

```
kimai_get_server_info           Version, plugins, timesheet config, color palette
kimai_get_current_user          The user behind the API token
kimai_list_users                List users, with visibility/search/sort filters
kimai_get_user                  Get one user
kimai_list_customers            List customers
kimai_get_customer              Get one customer
kimai_list_projects             List projects, filtered by customer or date range
kimai_get_project               Get one project
kimai_list_activities           List activities, filtered by project or globals-only
kimai_get_activity              Get one activity
kimai_list_tags                 Search tags by name, or list every tag name
kimai_list_timesheets           List timesheets with the full Kimai filter set
kimai_get_timesheet             Get one timesheet entry
kimai_list_active_timesheets    Currently running timesheets
kimai_list_recent_timesheets    Recent timesheet entries
kimai_list_teams                List teams
kimai_get_team                  Get one team with members and grants
kimai_list_invoices             List invoices, filtered by date, customer, or status
kimai_get_invoice               Get one invoice
kimai_download_invoice          Save a rendered invoice to a temp file
kimai_list_rates                Rates on a customer, project, or activity
kimai_list_comments             Comments on a customer or project
kimai_list_expenses             List expenses (expenses plugin)
kimai_get_expense               Get one expense (expenses plugin)
kimai_list_tasks                List tasks (task management plugin)
kimai_get_task                  Get one task (task management plugin)
kimai_list_absences             Absences (work contract plugin)
kimai_list_public_holidays      Configured public holidays (work contract plugin)
```

### Write (24)

```
kimai_create_timesheet            kimai_create_customer      kimai_add_rate
kimai_update_timesheet            kimai_update_customer      kimai_add_comment
kimai_stop_timesheet              kimai_create_project       kimai_pin_comment
kimai_restart_timesheet           kimai_update_project       kimai_update_meta_field
kimai_duplicate_timesheet         kimai_create_activity      kimai_add_team_assignment
kimai_toggle_timesheet_export     kimai_update_activity      kimai_update_invoice_custom_fields
kimai_create_team                 kimai_create_tag
kimai_update_team                 kimai_create_user
                                  kimai_update_user
                                  kimai_update_user_preferences
```

### Delete (11, require `KIMAI_ALLOW_DELETE=true`)

```
kimai_delete_timesheet     kimai_delete_team          kimai_delete_rate
kimai_delete_customer *    kimai_delete_tag           kimai_delete_comment
kimai_delete_project  *    kimai_delete_api_token     kimai_remove_team_assignment
kimai_delete_activity *                               kimai_delete_export_template

* cascading: see the table above
```

## API coverage

81 of the 85 live endpoints in the Kimai 2.65.0 core API, plus 6 plugin endpoints.

| Controller | Covered | Live | Notes |
|---|---|---|---|
| Status & configuration | 5 | 5 | |
| Users | 7 | 7 | |
| Customers | 13 | 13 | |
| Projects | 13 | 13 | |
| Activities | 9 | 9 | |
| Timesheets | 12 | 12 | |
| Teams | 13 | 13 | |
| Tags | 4 | 4 | |
| Invoices | 4 | 4 | |
| Export | 1 | 1 | |
| Actions | 0 | 4 | `/api/actions/*` returns UI menu links for Kimai's own web interface, which an MCP client has no use for |
| **Total** | **81** | **85** | |

The route table has 88 entries, but three of them (`POST /api/customers/{id}/team`, and the same on projects and activities) were removed upstream and answer 410 Gone. Team access is granted through `kimai_add_team_assignment` instead.

Plugin endpoints covered: expenses (2), tasks (2), absences (1), public holidays (1). These return a normal Kimai 404 when the matching plugin is not installed.

## Notes on Kimai's API

Behaviors that are easy to get wrong, all verified against a live 2.65.0 instance:

- **Timesheets default to the token owner.** `kimai_list_timesheets` returns only your own entries unless you pass `user: "all"`, which needs the `view_other_timesheet` permission. This is the most common cause of an undercounted total.
- **Tag filters must be exact.** Kimai answers HTTP 400, not an empty result, when a tag name does not exist. Check spelling with `kimai_list_tags`.
- **Boolean filters are `0|1` on the wire.** `exported`, `active`, and `billable` are booleans on the tool surface and are converted before the request; sending `true` directly to Kimai returns HTTP 400.
- **Four endpoints do not paginate.** `/api/teams`, `/api/timesheets/active`, `/api/tags`, and the rates and comments sub-resources return everything at once, and the tools report a plain count instead of a page number.
- **`/api/tags/find` needs a search term.** Called bare it returns an empty list, so `kimai_list_tags` falls back to `/api/tags` when no name is given.
