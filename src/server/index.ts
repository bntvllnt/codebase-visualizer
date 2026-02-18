import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import open from "open";
import type { CodebaseGraph } from "../types/index.js";
import { createApiRoutes } from "./api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function startServer(graph: CodebaseGraph, port: number, projectName?: string): Promise<void> {
  const app = express();

  // API routes
  app.use("/api", createApiRoutes(graph, projectName));

  // Serve static files (the 3D UI)
  const publicDir = path.resolve(__dirname, "../../public");
  app.use(express.static(publicDir));

  // Fallback to index.html for SPA
  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  // Try port, fallback on conflict
  const server = await tryListen(app, port);
  const actualPort = (server.address() as { port: number }).port;

  console.log(`3D map ready at http://localhost:${actualPort}`);
  await open(`http://localhost:${actualPort}`);

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    server.close();
    process.exit(0);
  });
}

function tryListen(
  app: express.Application,
  port: number,
  maxAttempts: number = 5
): Promise<ReturnType<typeof app.listen>> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function attempt(currentPort: number): void {
      attempts++;
      const server = app.listen(currentPort, () => { resolve(server); });
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
}
