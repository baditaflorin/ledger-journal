import { rmSync } from "node:fs";

const generatedPaths = [
  "docs/.nojekyll",
  "docs/404.html",
  "docs/assets",
  "docs/favicon.svg",
  "docs/index.html",
  "docs/manifest.webmanifest",
  "docs/sw.js",
  "docs/version.json",
];

for (const path of generatedPaths) {
  rmSync(path, { recursive: true, force: true });
}
