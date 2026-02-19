/**
 * Standalone server for e2e tests.
 * Bypasses CLI (commander + crash handlers) for stability.
 * Usage: node e2e/server.mjs [port]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { parseCodebase } from "../dist/parser/index.js";
import { buildGraph } from "../dist/graph/index.js";
import { analyzeGraph } from "../dist/analyzer/index.js";
import { setGraph } from "../dist/server/graph-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = parseInt(process.argv[2] || "3344", 10);
const fixturePath = path.resolve(__dirname, "fixture-project");

// Parse and build graph
const files = parseCodebase(fixturePath);
const built = buildGraph(files);
const codebaseGraph = analyzeGraph(built, files);

// Read project name from fixture package.json
let projectName = "fixture-project";
try {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(fixturePath, "package.json"), "utf-8"));
  if (pkg.name) projectName = pkg.name;
} catch { /* use default */ }

setGraph(codebaseGraph, projectName);

// Catch all errors — NEVER let the server crash during tests
process.on("uncaughtException", (err) => {
  console.error("[e2e-server] uncaughtException:", err.message);
});
process.on("unhandledRejection", (err) => {
  console.error("[e2e-server] unhandledRejection:", err instanceof Error ? err.message : err);
});

// Start Next.js production server
const projectDir = path.resolve(__dirname, "..");
const next = (await import("next")).default;
const app = next({ dev: false, dir: projectDir });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error("[e2e-server] request error:", err.message);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });
});

server.on("error", (err) => {
  console.error("[e2e-server] server error:", err.message);
});

server.listen(port, () => {
  console.log(`E2E server ready at http://localhost:${port}`);
});

process.on("SIGINT", () => {
  server.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  server.close();
  process.exit(0);
});
