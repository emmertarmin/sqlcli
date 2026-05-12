#!/usr/bin/env bun

import { printCommandHelp, printRootHelp } from "./cli/help.js";
import { parseCli } from "./cli/parse.js";
import { ensureConfigDir } from "./config/load-config.js";
import { printVersion } from "./version.js";

async function main() {
  await ensureConfigDir();

  const parsed = parseCli(process.argv.slice(2));
  const wantsHelp = parsed.values.help === true;
  const wantsVersion = parsed.values.version === true;

  if (wantsVersion) {
    printVersion();
    return;
  }

  if (!parsed.command) {
    if (wantsHelp || parsed.positionals.length === 0) {
      printRootHelp();
      return;
    }

    throw new Error("Missing command. Run `sqlcli --help` to see available commands.");
  }

  if (wantsHelp || typeof parsed.command.execute !== "function") {
    printCommandHelp(parsed.command, parsed.path);
    return;
  }

  await parsed.command.execute({
    values: parsed.values,
    positionals: parsed.positionals,
  });
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  });
