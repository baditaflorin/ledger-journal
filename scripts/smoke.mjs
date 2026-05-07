import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const port = Number(
  process.env.SMOKE_PORT ?? 45_000 + Math.floor(Math.random() * 1_000),
);
let serverOutput = "";
const server = spawn(process.execPath, ["scripts/serve-pages.mjs"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

try {
  await waitForServer(port);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/ledger-journal/`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("heading", { name: "Ledger Journal" }).waitFor();
  await page
    .getByLabel("New passphrase")
    .fill("correct horse battery staple 123");
  await page
    .getByLabel("Confirm passphrase")
    .fill("correct horse battery staple 123");
  await page.getByRole("button", { name: "Create vault" }).click();
  await page
    .getByLabel("Entry body")
    .fill("Smoke test entry for the anchored journal.");
  await page.getByLabel("Tags").fill("smoke,local");
  await page.getByRole("button", { name: "Seal entry" }).click();
  await page.getByText("Chain valid").waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Load DuckDB index" }).click();
  await page
    .getByText(/DuckDB ready|DuckDB unavailable/)
    .waitFor({ timeout: 30_000 });
  await browser.close();
} finally {
  server.kill("SIGTERM");
}

async function waitForServer(portNumber) {
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    if (server.exitCode !== null) {
      throw new Error(
        `Pages preview server exited before smoke test.\n${serverOutput}`,
      );
    }
    try {
      const response = await fetch(
        `http://127.0.0.1:${portNumber}/ledger-journal/`,
      );
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(
    `Pages preview server did not start in time.\n${serverOutput}`,
  );
}
