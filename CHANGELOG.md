# Changelog

## v0.2.0

### Added or Changed

- Added interactive and scriptable saved-connection creation with secure password input and configurable connection options.
- Changed connection listings to use a concise table by default and redacted full details in verbose output.
- Added versioned config migrations and atomic config writes with private file permissions.

## v0.1.6

### Added or Changed

- Added CSV output for query results, including headers, escaping, multiline fields, empty-result messaging, and multiple recordset support.

## v0.1.5

### Added or Changed

- Consolidated JSON query output to expose `recordsets` only.
- Updated table output to print every returned recordset.

### Removed

- Removed the redundant top-level `recordset` field from query results.

## v0.1.4

### Added or Changed

- Expanded the README with install instructions, quickstart, configuration, scripting examples, command overview, motivation, FAQ, and project status.

## v0.1.3

### Added or Changed

- Improved table formatting to handle multiple recordsets returned by a query.

## v0.1.2

### Added or Changed

- Added support for SQL Server named instances in connection server names.

## v0.1.1

### Added or Changed

- Added npm package publishing metadata and license information.
- Added the `version` command and top-level version flags.
- Updated package naming and install documentation.

## v0.1.0

### Added or Changed

- Added the initial SQL Server CLI with query execution, named connections, reusable sessions, table and JSON output, help text, and tests.
