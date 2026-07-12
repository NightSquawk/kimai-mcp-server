# @nightsquawktech/kimai-mcp-server

Model Context Protocol server for Kimai time-tracking instances. Read tools cover the full Kimai API surface; timesheet write tools exist but are guarded behind explicit authorization.

## API Notes

Kimai exposes a JSON API under `/api`. Current Kimai documentation uses bearer-token authentication:

```http
Authorization: Bearer <api-token>
```

The base URL should be the browser URL without a trailing slash, for example `https://demo.kimai.org`, not `https://demo.kimai.org/`. Kimai's current API docs are available at your own instance under `/api/doc`, and official docs note that the OpenAPI export is available from that UI.

Pagination uses `page` and `size` query parameters. Kimai defaults to 50 records per page and documents 500 as the maximum page size. Paginated responses may include `X-Page`, `X-Total-Count`, `X-Total-Pages`, and `X-Per-Page` headers.

Read tools are safe to call without changing Kimai. Write tools are intentionally guarded because Kimai timekeeping data is sensitive:

- Every write tool requires `authorization_confirmed: true`.
- Every write tool requires an `authorization_note` describing the user's explicit approval.
- Every write tool writes a JSON backup under the system temp directory before or immediately after mutation.
- Update/state-change tools save the previous Kimai record before calling the mutation endpoint.
- Create/duplicate tools save the request/source and created record so the created ID can be audited and reverted manually if needed.
- Delete tools are intentionally not exposed.

References:

- https://www.kimai.org/documentation/rest-api.html
- https://www.kimai.org/documentation/user-api.html
- https://www.kimai.org/documentation/api-pagination.html

## Tools

- `kimai_get_server_info` reads `/api/ping`, `/api/version`, `/api/plugins`, and `/api/config/timesheet`.
- `kimai_get_current_user` reads `/api/users/me`.
- `kimai_list_users` and `kimai_get_user` read users.
- `kimai_list_customers` and `kimai_get_customer` read customers.
- `kimai_list_projects` and `kimai_get_project` read projects.
- `kimai_list_activities` and `kimai_get_activity` read activities.
- `kimai_list_tags` reads tags.
- `kimai_list_timesheets`, `kimai_get_timesheet`, `kimai_list_active_timesheets`, and `kimai_list_recent_timesheets` read time entries.
- `kimai_create_timesheet` creates a time entry after explicit authorization and stores a temp backup.
- `kimai_update_timesheet` updates a time entry after explicit authorization and stores the previous record in a temp backup.
- `kimai_stop_timesheet` stops an active time entry after explicit authorization and stores the previous record in a temp backup.
- `kimai_restart_timesheet` restarts a stopped time entry after explicit authorization and stores the previous record in a temp backup.
- `kimai_duplicate_timesheet` duplicates a time entry after explicit authorization and stores source/created records in a temp backup.
- `kimai_list_teams` and `kimai_get_team` read teams.
- `kimai_list_invoices` and `kimai_get_invoice` read invoice history.
- `kimai_list_expenses` and `kimai_get_expense` read expenses when that endpoint is available.
- `kimai_list_tasks` and `kimai_get_task` read tasks when that endpoint is available.

## Setup

Configure an MCP client to run the server with `npx`:

```json
{
  "mcpServers": {
    "kimai": {
      "command": "npx",
      "args": ["-y", "@nightsquawktech/kimai-mcp-server"],
      "env": {
        "KIMAI_BASE_URL": "https://your-instance.example.com",
        "KIMAI_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

For Codex global TOML config:

```toml
[mcp_servers.kimai]
command = "npx"
args = ["-y", "@nightsquawktech/kimai-mcp-server"]

[mcp_servers.kimai.env]
KIMAI_BASE_URL = "https://your-instance.example.com"
KIMAI_API_TOKEN = "your-api-token"
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `KIMAI_BASE_URL` | Yes | Base URL of your Kimai instance without a trailing slash, e.g. `https://your-instance.example.com` |
| `KIMAI_API_TOKEN` | Yes | Kimai API token (bearer token) |
| `KIMAI_TIMEOUT_MS` | No | HTTP request timeout in milliseconds, default `30000` |

## Development

```sh
npm install
npm run dev
npm run build
```

Create `.env` for local development:

```env
KIMAI_BASE_URL=https://your-instance.example.com
KIMAI_API_TOKEN=your-api-token
KIMAI_TIMEOUT_MS=30000
```

The server uses stdio for local MCP clients. Use stderr for logs so stdout remains reserved for MCP protocol messages.

## License

Licensed under the [GNU AGPL v3.0](./LICENSE). Free for personal and open-source use.

Organizations that cannot comply with the AGPL can purchase a commercial license. See [COMMERCIAL.md](./COMMERCIAL.md) or contact hello@nightsquawk.tech.
