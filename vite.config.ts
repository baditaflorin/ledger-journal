import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as {
  version: string;
};

function gitValue(command: string, fallback: string) {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
}

const commit = gitValue("git rev-parse --short HEAD", "dev");
const repoUrl = "https://github.com/baditaflorin/ledger-journal";
const paypalUrl = "https://www.paypal.com/paypalme/florinbadita";
const base = process.env.VITE_BASE_PATH ?? "/ledger-journal/";

export default defineConfig({
  base,
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT_SHA__: JSON.stringify(commit),
    __REPO_URL__: JSON.stringify(repoUrl),
    __PAYPAL_URL__: JSON.stringify(paypalUrl),
  },
  build: {
    outDir: "docs",
    emptyOutDir: false,
    sourcemap: true,
    target: "es2022",
    rollupOptions: {
      input: resolve(__dirname, "index.html"),
      output: {
        manualChunks(id) {
          if (id.includes("@duckdb/duckdb-wasm")) return "duckdb";
          if (id.includes("@huggingface/transformers")) return "local-ai";
          if (id.includes("age-encryption") || id.includes("@noble"))
            return "crypto";
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
});
