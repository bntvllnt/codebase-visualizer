#!/usr/bin/env node

// Crash = exit immediately (don't let tsx watch swallow it)
process.on("uncaughtException", (err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});

import fs from "fs";
import path from "path";
import { Command } from "commander";
import { parseCodebase } from "./parser/index.js";
import { buildGraph } from "./graph/index.js";
import { analyzeGraph } from "./analyzer/index.js";
import { startServer } from "./server/index.js";
import { startMcpServer } from "./mcp/index.js";

const program = new Command();

program
  .name("codebase-visualizer")
  .description("3D interactive codebase visualization with MCP integration")
  .version("0.1.0")
  .argument("<path>", "Path to the codebase directory to visualize")
  .option("--mcp", "Start as MCP stdio server (no browser, no HTTP)")
  .option("--port <number>", "Web server port (browser mode only)", "3333")
  .action(async (targetPath: string, options: { mcp?: boolean; port: string }) => {
    try {
      // Parse
      console.log(`Parsing ${targetPath}...`);
      const files = parseCodebase(targetPath);
      console.log(`Parsed ${files.length} files`);

      // Build graph
      const built = buildGraph(files);
      console.log(
        `Built graph: ${built.nodes.filter((n) => n.type === "file").length} files, ` +
          `${built.nodes.filter((n) => n.type === "function").length} functions, ` +
          `${built.edges.length} dependencies`
      );

      // Analyze
      const codebaseGraph = analyzeGraph(built);
      console.log(
        `Analysis complete: ${codebaseGraph.stats.circularDeps.length} circular deps, ` +
          `${codebaseGraph.forceAnalysis.tensionFiles.length} tension files`
      );

      if (options.mcp) {
        // MCP mode — stdio server
        await startMcpServer(codebaseGraph);
      } else {
        // Browser mode — web server
        const port = parseInt(options.port, 10);
        let projectName = path.basename(path.resolve(targetPath));
        try {
          const pkg = JSON.parse(fs.readFileSync(path.resolve(targetPath, "package.json"), "utf-8")) as { name?: string };
          if (pkg.name) projectName = pkg.name;
        } catch { /* no package.json — use directory name */ }
        await startServer(codebaseGraph, port, projectName);
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
