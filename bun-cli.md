# Bun CLI notes

If you're building a CLI with Bun, the docs show solid runtime helpers, but not a full built-in command framework.

- Use `Bun.argv` for raw arguments and `util.parseArgs` for flag parsing: `docs/guides/process/argv.mdx`
- Read interactive input via `console` or `Bun.stdin`: `docs/guides/process/stdin.mdx`, `docs/runtime/console.mdx`
- Bun exposes `prompt`, `confirm`, and `alert` for command-line tools: `docs/runtime/globals.mdx`
- Node compatibility includes `node:readline` and `node:tty`: `docs/runtime/nodejs-compat.mdx`
- Terminal helpers like `Bun.stringWidth()`, `Bun.wrapAnsi()`, `Bun.stripANSI()`, and `Bun.which()` are documented in `docs/runtime/utils.mdx`
- You can ship a standalone executable with `bun build --compile`: `docs/bundler/executables.mdx`

Notably, I did **not** find a Bun-native built-in equivalent to Commander/Yargs/CAC for subcommands, help generation, or richer CLI command trees. The docs mostly point toward combining Bun runtime APIs with Node-compatible utilities like `util.parseArgs`.
