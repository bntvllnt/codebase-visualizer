#!/usr/bin/env node

process.on("uncaughtException", (err) => {
  process.stderr.write(`Fatal: ${err.stack ?? err.message}\n`);
  process.exit(1);
});

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Command } from "commander";
import { parseCodebase } from "./parser/index.js";
import { buildGraph } from "./graph/index.js";
import { analyzeGraph } from "./analyzer/index.js";
import { startMcpServer } from "./mcp/index.js";
import { setGraph } from "./server/graph-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const program = new Command();

program
  .name("codebase-visualizer")
  .description("3D interactive codebase visualization with MCP integration")
  .version("1.0.0")
  .argument("<path>", "Path to the codebase directory to visualize")
  .option("--mcp", "Start as MCP stdio server (no browser, no HTTP)")
  .option("--port <number>", "Web server port (browser mode only)", "3333")
  .action(async (targetPath: string, options: { mcp?: boolean; port: string }) => {
    try {
      console.log(`Parsing ${targetPath}...`);
      const files = parseCodebase(targetPath);
      console.log(`Parsed ${files.length} files`);

      const built = buildGraph(files);
      console.log(
        `Built graph: ${built.nodes.filter((n) => n.type === "file").length} files, ` +
          `${built.nodes.filter((n) => n.type === "function").length} functions, ` +
          `${built.edges.length} dependencies`,
      );

      const codebaseGraph = analyzeGraph(built, files);
      console.log(
        `Analysis complete: ${codebaseGraph.stats.circularDeps.length} circular deps, ` +
          `${codebaseGraph.forceAnalysis.tensionFiles.length} tension files`,
      );

      if (options.mcp) {
        await startMcpServer(codebaseGraph);
      } else {
        const port = parseInt(options.port, 10);
        let projectName = path.basename(path.resolve(targetPath));
        try {
          const pkg = JSON.parse(fs.readFileSync(path.resolve(targetPath, "package.json"), "utf-8")) as { name?: string };
          if (pkg.name) projectName = pkg.name;
        } catch { /* no package.json — use directory name */ }

        setGraph(codebaseGraph, projectName);

        const projectDir = path.resolve(__dirname, "..");
        const isDev = import.meta.url.endsWith(".ts");
        const next = (await import("next")).default;
        const app = next({ dev: isDev, dir: projectDir });
        const handle = app.getRequestHandler();

        await app.prepare();

        const server = createServer((req, res) => {
          handle(req, res).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            process.stderr.write(`Request error: ${req.url} — ${msg}\n`);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.end("Internal Server Error");
            }
          });
        });

        await new Promise<void>((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 5;

          function attempt(currentPort: number): void {
            attempts++;
            server.listen(currentPort, () => { resolve(); });
            server.on("error", (err: NodeJS.ErrnoException) => {
              if (err.code === "EADDRINUSE" && attempts < maxAttempts) {
                console.warn(`Port ${currentPort} in use, trying ${currentPort + 1}...`);
                attempt(currentPort + 1);
              } else {
                reject(err);
              }
            });
          }

          attempt(port);
        });

        const actualPort = (server.address() as { port: number }).port;
        console.log(`3D map ready at http://localhost:${actualPort}`);

        /* Browser auto-open disabled — use URL above */
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error("Unknown error:", error);
      }
      process.exit(1);
    }
  });

program.parse();
