# sqlcli

A small SQL CLI created for my personal use.

At the moment, only Microsoft SQL Server (mssql) is supported and tested.

## Requirements

- [Bun](https://bun.sh/)

## Install

```bash
bun install -g sqlcli
```

Then run:

```bash
sqlcli --help
sqlcli --version
```

## Usage

```text
sqlcli

Run SQL queries and inspect configured database connections.

Usage:
  sqlcli <subcommand>

Options:
  --help, -h
      Show help
  --version, -v
      Show version

Subcommands:
  query - Execute a SQL statement
  connection - Inspect and manage saved connections
  session - Manage the reusable SQL session
  help - Show help
  version - Show version

Run `sqlcli <command> --help` for command-specific help.
```

## License

MIT
