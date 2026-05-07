import { execSync } from "node:child_process";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";

function gitValue(command, fallback) {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
}

const commit = gitValue("git rev-parse --short HEAD", "dev");
const version = JSON.parse(readFileSync("package.json", "utf8")).version;

copyFileSync("docs/index.html", "docs/404.html");
writeFileSync("docs/.nojekyll", "");
writeFileSync(
  "docs/version.json",
  JSON.stringify(
    {
      version,
      commit,
      repo: "https://github.com/baditaflorin/ledger-journal",
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
