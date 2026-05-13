# sqlcli

A minimal Bun-powered CLI for running ad-hoc queries against Microsoft SQL Server using named local connections.

## Install

Requires [Bun](https://bun.sh/).

```bash
bun add -g @emmertarmin/sqlcli
sqlcli --version
```

## Quickstart

### 1. Configure a connection

```bash
mkdir -p ~/.config/sqlcli
```

Create `~/.config/sqlcli/config.json`:

```json
{
  "connections": {
    "local": {
      "server": "localhost",
      "port": 1433,
      "user": "sa",
      "password": "*****",
      "database": "master",
      "options": {
        "trustServerCertificate": true
      }
    }
  }
}
```

For local testing with the included docker-compose.yml, create a .env file with `SA_PASSWORD=*****` and add your preferred password to the config.

### 2. Verify it

```bash
sqlcli connection list
```

### 3. Run a query

```bash
sqlcli query -c local "SELECT @@VERSION;"
```

Or pipe it in:

```bash
echo "SELECT @@VERSION;" | sqlcli query -c local
```

Or use the `--sql` flag explicitly:

```bash
sqlcli query --connection local --sql "SELECT @@VERSION;"
```

## Piping & scripting

sqlcli reads SQL from `stdin`, so it plays nicely with pipes, `watch`, and scripts.

For agentic use I recommend using read-only database users.

`--output json` is useful for scripting, or for combining with `jq`. E.g.:

```bash
sqlcli query -c local --output json "SELECT name FROM sys.databases;" | jq '.recordsets[][].name'
```

## Commands

| Command | Description |
|---------|-------------|
| `query [statement]` | Execute a SQL statement (or pipe via `stdin`) |
| `connection list` | List configured connections |
| `session start\|stop\|status` | Manage a reusable SQL session |
| `version` | Show version |
| `help` | Show help |

Run `sqlcli <command> --help` for command-specific flags.

## Motivation

SSMS, Azure Data Studio, and the VSCode MSSQL Extension are excellent for deep database work, complex tasks, and schema management. The official `sqlcmd` utility is reliable for scripting and batch execution.

For quick ad-hoc queries against named connections, however, I always found GUI tools heavy and slow: they require opening an application and navigating connection dialogs. `sqlcmd` requires repeating full connection flags for each invocation and does not natively support named connection profiles.

`sqlcli` targets this specific workflow. Named connections eliminate the need to remember server and credential details for every query. JSON output integrates cleanly with standard Unix tools (`watch`, `jq`, `grep`). Session management reduces overhead when automating queries or integrating with agents.

This tool does not attempt to replace full-featured database clients or `sqlcmd`. It focuses narrowly on fast, scriptable, terminal-first query execution.

## FAQ

**Why not just use `sqlcmd`?**

`sqlcli` stores named connections in a config file, which is useful when working with many databases. Additionally, this codebase being small lets me add custom features (e.g., CSV output) and tailor ergonomics to my personal preferences.

**Why Bun instead of Node.js?**

I already use Bun for other tools on my machines. If the tool were intended for wide distribution, Node.js would likely be the more conservative and stable choice.

**Why store passwords in a plaintext JSON config file?**

Currently, the config file approach prioritizes convenience for local and development use. The plan is to migrate to a more secure solution such as [Bun.secrets](https://bun.sh/docs/runtime/secrets) or another secrets manager in the future.

**Does it support Windows Authentication?**

No — Windows Authentication is not needed for the current use cases. The tool is primarily used with local Docker instances and SQL Server authentication.

## Status

Supports Microsoft SQL Server (`mssql`). Tested primarily against local Docker instances.

## License

MIT
