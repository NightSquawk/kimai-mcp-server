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

## Security & write safety

Kimai credentials: generate an API token in your Kimai user profile. The token inherits that user's permissions, so use a dedicated Kimai user with the smallest role that covers what you need.

- **23 of the 28 tools are read-only.** They only issue GET requests and cannot change anything in Kimai.
- **5 timesheet write tools** exist: `kimai_create_timesheet`, `kimai_update_timesheet`, `kimai_stop_timesheet`, `kimai_restart_timesheet`, `kimai_duplicate_timesheet`. There is no env gate; each call is guarded instead:
  - Every write requires `authorization_confirmed: true` and an `authorization_note` (8+ characters) recording the user's explicit approval. The tool descriptions instruct the model to call them only after a human authorizes the edit.
  - Every write saves a JSON backup (previous record, request, and result) to `kimai-mcp-backups` in the OS temp directory, so edits can be audited and manually reverted.
- No delete tools are exposed.
- All requests go directly from your machine to your Kimai instance; nothing passes through third parties.

> [!IMPORTANT]
> The authorization fields are a guardrail, not a security boundary. The env vars in your MCP config are real credentials, and an AI agent with shell access can bypass the MCP tools and call the Kimai API directly with them. If you need hard read-only, enforce it at the source: give the token's Kimai user a role without timesheet edit permissions.

## Tools

```
kimai_get_server_info           Kimai version, plugins, and timesheet config
kimai_get_current_user          The user behind the API token
kimai_list_users                List users
kimai_get_user                  Get one user
kimai_list_customers            List customers
kimai_get_customer              Get one customer
kimai_list_projects             List projects, optionally filtered by customer
kimai_get_project               Get one project
kimai_list_activities           List activities, optionally filtered by project
kimai_get_activity              Get one activity
kimai_list_tags                 Find tags by name
kimai_list_timesheets           List timesheets with user/customer/project/date/tag filters
kimai_get_timesheet             Get one timesheet entry
kimai_list_active_timesheets    Currently running timesheets
kimai_list_recent_timesheets    Recent timesheet entries
kimai_create_timesheet          Create a timesheet entry (write, requires authorization fields)
kimai_update_timesheet          Update a timesheet entry (write, requires authorization fields)
kimai_stop_timesheet            Stop a running timesheet (write, requires authorization fields)
kimai_restart_timesheet         Restart a stopped timesheet (write, requires authorization fields)
kimai_duplicate_timesheet       Duplicate a timesheet entry (write, requires authorization fields)
kimai_list_teams                List teams
kimai_get_team                  Get one team
kimai_list_invoices             List invoices
kimai_get_invoice               Get one invoice
kimai_list_expenses             List expenses (expenses plugin)
kimai_get_expense               Get one expense (expenses plugin)
kimai_list_tasks                List tasks (tasks plugin)
kimai_get_task                  Get one task (tasks plugin)
```

## API coverage

31 operations covered across 28 tools.

| Category | Operations |
|---|---|
| Server & status | 4 |
| Users | 3 |
| Customers, projects, activities, tags | 7 |
| Timesheets (read) | 4 |
| Timesheets (write) | 5 |
| Teams & invoices | 4 |
| Plugins: expenses & tasks | 4 |

<details>
<summary><strong>Server & status</strong> (4 operations)</summary>

| Method | Path | Tool |
|---|---|---|
| GET | `/api/ping` | `kimai_get_server_info` |
| GET | `/api/version` | `kimai_get_server_info` |
| GET | `/api/plugins` | `kimai_get_server_info` |
| GET | `/api/config/timesheet` | `kimai_get_server_info` |

</details>

<details>
<summary><strong>Users</strong> (3 operations)</summary>

| Method | Path | Tool |
|---|---|---|
| GET | `/api/users/me` | `kimai_get_current_user` |
| GET | `/api/users` | `kimai_list_users` |
| GET | `/api/users/{id}` | `kimai_get_user` |

</details>

<details>
<summary><strong>Customers, projects, activities, tags</strong> (7 operations)</summary>

| Method | Path | Tool |
|---|---|---|
| GET | `/api/customers` | `kimai_list_customers` |
| GET | `/api/customers/{id}` | `kimai_get_customer` |
| GET | `/api/projects` | `kimai_list_projects` |
| GET | `/api/projects/{id}` | `kimai_get_project` |
| GET | `/api/activities` | `kimai_list_activities` |
| GET | `/api/activities/{id}` | `kimai_get_activity` |
| GET | `/api/tags/find` | `kimai_list_tags` |

</details>

<details>
<summary><strong>Timesheets (read)</strong> (4 operations)</summary>

| Method | Path | Tool |
|---|---|---|
| GET | `/api/timesheets` | `kimai_list_timesheets` |
| GET | `/api/timesheets/{id}` | `kimai_get_timesheet` |
| GET | `/api/timesheets/active` | `kimai_list_active_timesheets` |
| GET | `/api/timesheets/recent` | `kimai_list_recent_timesheets` |

</details>

<details>
<summary><strong>Timesheets (write)</strong> (5 operations)</summary>

| Method | Path | Tool |
|---|---|---|
| POST | `/api/timesheets` | `kimai_create_timesheet` |
| PATCH | `/api/timesheets/{id}` | `kimai_update_timesheet` |
| PATCH | `/api/timesheets/{id}/stop` | `kimai_stop_timesheet` |
| PATCH | `/api/timesheets/{id}/restart` | `kimai_restart_timesheet` |
| PATCH | `/api/timesheets/{id}/duplicate` | `kimai_duplicate_timesheet` |

</details>

<details>
<summary><strong>Teams & invoices</strong> (4 operations)</summary>

| Method | Path | Tool |
|---|---|---|
| GET | `/api/teams` | `kimai_list_teams` |
| GET | `/api/teams/{id}` | `kimai_get_team` |
| GET | `/api/invoices` | `kimai_list_invoices` |
| GET | `/api/invoices/{id}` | `kimai_get_invoice` |

</details>

<details>
<summary><strong>Plugins: expenses & tasks</strong> (4 operations)</summary>

| Method | Path | Tool |
|---|---|---|
| GET | `/api/expenses` | `kimai_list_expenses` |
| GET | `/api/expenses/{id}` | `kimai_get_expense` |
| GET | `/api/tasks` | `kimai_list_tasks` |
| GET | `/api/tasks/{id}` | `kimai_get_task` |

</details>

## Contributing

Contributions and issues are welcome. Please open an issue first before submitting a PR.

## License

AGPL-3.0: free for personal and open-source use. Organizations that cannot comply with the AGPL can purchase a commercial license, and hosted/managed versions are available. See [COMMERCIAL.md](https://github.com/NightSquawk/kimai-mcp-server/blob/v1.0.0/COMMERCIAL.md) or contact hello@nightsquawk.tech.

### Copyright

For copyright concerns or takedown requests, contact hello@nightsquawk.tech.
