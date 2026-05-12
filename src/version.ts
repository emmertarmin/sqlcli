import packageJson from "../package.json" with { type: "json" };

export const VERSION = packageJson.version;

export function printVersion() {
  console.log(`sqlcli v${VERSION}`);
}
