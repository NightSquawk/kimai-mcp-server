# Security Policy

## Supported Versions

This project follows semantic versioning and publishes releases from the
`v1.0.0` branch. Only the latest published npm release receives security
fixes; please upgrade to the latest `@nightsquawktech/kimai-mcp-server`
before reporting an issue.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report privately using one of:

- [GitHub Security Advisories](https://github.com/NightSquawk/kimai-mcp-server/security/advisories/new)
  for this repository (preferred).
- Email **hello@nightsquawk.tech** with details and, if possible, steps to
  reproduce.

We aim to acknowledge reports within 5 business days and to ship a fix or
mitigation as soon as reasonably possible, coordinating disclosure timing
with the reporter.

## Scope

This is an MCP (Model Context Protocol) server that proxies requests to a
user-configured, self-hosted Kimai instance using an API token supplied via
environment variables. Reports involving credential handling, request
construction, or the timesheet-write authorization/backup guards in
`src/tools/timesheet-mutations.ts` are especially welcome.
