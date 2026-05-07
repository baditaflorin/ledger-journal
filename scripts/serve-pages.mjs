import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "docs");
const port = Number(process.env.PORT ?? 4173);
const base = "/ledger-journal/";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".map": "application/json; charset=utf-8",
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") {
    response.writeHead(302, { Location: base });
    response.end();
    return;
  }
  if (!pathname.startsWith(base)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  pathname = pathname.slice(base.length);
  const candidate = normalize(join(root, pathname));
  let file =
    candidate.startsWith(root) && existsSync(candidate)
      ? candidate
      : join(root, "index.html");
  if (existsSync(file) && statSync(file).isDirectory())
    file = join(file, "index.html");

  if (!existsSync(file)) {
    response.writeHead(404);
    response.end("Build docs/ first");
    return;
  }

  response.writeHead(200, {
    "Content-Type": types[extname(file)] ?? "application/octet-stream",
    "Cache-Control": file.endsWith("index.html")
      ? "no-cache"
      : "public, max-age=31536000, immutable",
  });
  createReadStream(file).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Pages preview: http://127.0.0.1:${port}${base}`);
});
