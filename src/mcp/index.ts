import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { CodebaseGraph } from "../types/index.js";

export async function startMcpServer(graph: CodebaseGraph): Promise<void> {
  const server = new McpServer({
    name: "codebase-visualizer",
    version: "0.1.0",
  });

  // Tool 1: codebase_overview
  server.tool(
    "codebase_overview",
    "Get a high-level overview of the codebase structure, modules, entry points, and key metrics",
    { depth: z.number().optional().describe("Module depth (default: 1)") },
    async (_params) => {
      const modules = [...graph.moduleMetrics.values()].map((m) => ({
        path: m.path,
        files: m.files,
        loc: m.loc,
        avgCoupling: m.cohesion < 0.4 ? "HIGH" : m.cohesion < 0.7 ? "MEDIUM" : "LOW",
        cohesion: m.cohesion,
      }));

      const topDepended = [...graph.fileMetrics.entries()]
        .sort(([, a], [, b]) => b.fanIn - a.fanIn)
        .slice(0, 5)
        .map(([path, m]) => `${path} (${m.fanIn} dependents)`);

      const maxDepth = Math.max(
        ...graph.nodes
          .filter((n) => n.type === "file")
          .map((n) => n.path.split("/").length)
      );

      const overview = {
        totalFiles: graph.stats.totalFiles,
        totalFunctions: graph.stats.totalFunctions,
        totalDependencies: graph.stats.totalDependencies,
        modules: modules.sort((a, b) => b.files - a.files),
        topDependedFiles: topDepended,
        metrics: {
          avgLOC: Math.round(
            graph.nodes.filter((n) => n.type === "file").reduce((sum, n) => sum + n.loc, 0) /
              graph.stats.totalFiles
          ),
          maxDepth,
          circularDeps: graph.stats.circularDeps.length,
        },
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(overview, null, 2) }] };
    }
  );

  // Tool 2: file_context
  server.tool(
    "file_context",
    "Get detailed context for a specific file: exports, imports, dependents, and metrics",
    { filePath: z.string().describe("Relative path to the file") },
    async ({ filePath }) => {
      const metrics = graph.fileMetrics.get(filePath);
      if (!metrics) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: `File not found in graph: ${filePath}` }) }],
          isError: true,
        };
      }

      const node = graph.nodes.find((n) => n.id === filePath && n.type === "file");
      const fileExports = graph.nodes
        .filter((n) => n.parentFile === filePath)
        .map((n) => ({ name: n.label, type: "function", loc: n.loc }));

      const imports = graph.edges
        .filter((e) => e.source === filePath)
        .map((e) => ({ from: e.target, symbols: e.symbols }));

      const dependents = graph.edges
        .filter((e) => e.target === filePath)
        .map((e) => ({ path: e.source, symbols: e.symbols }));

      const context = {
        path: filePath,
        loc: node?.loc ?? 0,
        exports: fileExports,
        imports,
        dependents,
        metrics: {
          pageRank: Math.round(metrics.pageRank * 1000) / 1000,
          betweenness: Math.round(metrics.betweenness * 100) / 100,
          fanIn: metrics.fanIn,
          fanOut: metrics.fanOut,
          coupling: Math.round(metrics.coupling * 100) / 100,
          tension: metrics.tension,
          isBridge: metrics.isBridge,
        },
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(context, null, 2) }] };
    }
  );

  // Tool 3: get_dependents
  server.tool(
    "get_dependents",
    "Get all files that depend on a given file (blast radius analysis)",
    {
      filePath: z.string().describe("Relative path to the file"),
      depth: z.number().optional().describe("Max traversal depth (default: 2)"),
    },
    async ({ filePath, depth }) => {
      if (!graph.fileMetrics.has(filePath)) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: `File not found in graph: ${filePath}` }) }],
          isError: true,
        };
      }

      const maxDepth = depth ?? 2;
      const directDependents = graph.edges
        .filter((e) => e.target === filePath)
        .map((e) => ({ path: e.source, symbols: e.symbols }));

      const transitive: Array<{ path: string; throughPath: string[]; depth: number }> = [];
      const visited = new Set<string>([filePath]);

      function bfs(current: string[], currentDepth: number, pathSoFar: string[]): void {
        if (currentDepth > maxDepth) return;
        const next: string[] = [];

        for (const node of current) {
          const deps = graph.edges.filter((e) => e.target === node).map((e) => e.source);
          for (const dep of deps) {
            if (visited.has(dep)) continue;
            visited.add(dep);
            if (currentDepth > 1) {
              transitive.push({ path: dep, throughPath: [...pathSoFar, node], depth: currentDepth });
            }
            next.push(dep);
          }
        }

        if (next.length > 0) bfs(next, currentDepth + 1, [...pathSoFar, ...current]);
      }

      bfs([filePath], 1, []);

      const totalAffected = visited.size - 1;
      const riskLevel = totalAffected > 20 ? "HIGH" : totalAffected > 5 ? "MEDIUM" : "LOW";

      const result = { file: filePath, directDependents, transitiveDependents: transitive, totalAffected, riskLevel };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Tool 4: find_hotspots
  server.tool(
    "find_hotspots",
    "Find the most problematic files by a given metric (coupling, pagerank, fan_in, fan_out, betweenness, tension, escape_velocity)",
    {
      metric: z
        .enum(["coupling", "pagerank", "fan_in", "fan_out", "betweenness", "tension", "escape_velocity"])
        .describe("Metric to rank by"),
      limit: z.number().optional().describe("Number of results (default: 10)"),
    },
    async ({ metric, limit }) => {
      const maxResults = limit ?? 10;

      type ScoredFile = { path: string; score: number; reason: string };
      const scored: ScoredFile[] = [];

      if (metric === "escape_velocity") {
        for (const mod of graph.moduleMetrics.values()) {
          scored.push({
            path: mod.path,
            score: mod.escapeVelocity,
            reason: `${mod.dependedBy.length} modules depend on it, ${mod.externalDeps} external deps`,
          });
        }
      } else {
        for (const [filePath, metrics] of graph.fileMetrics) {
          let score: number;
          let reason: string;

          switch (metric) {
            case "coupling":
              score = metrics.coupling;
              reason = `fan-in: ${metrics.fanIn}, fan-out: ${metrics.fanOut}`;
              break;
            case "pagerank":
              score = metrics.pageRank;
              reason = `${metrics.fanIn} dependents`;
              break;
            case "fan_in":
              score = metrics.fanIn;
              reason = `${metrics.fanIn} files import this`;
              break;
            case "fan_out":
              score = metrics.fanOut;
              reason = `imports ${metrics.fanOut} files`;
              break;
            case "betweenness":
              score = metrics.betweenness;
              reason = metrics.isBridge ? "bridge between clusters" : "on many shortest paths";
              break;
            case "tension":
              score = metrics.tension;
              reason = score > 0 ? "pulled by multiple modules" : "no tension";
              break;
            default:
              score = 0;
              reason = "";
          }

          scored.push({ path: filePath, score, reason });
        }
      }

      const hotspots = scored.sort((a, b) => b.score - a.score).slice(0, maxResults);
      const topIssue = hotspots[0];
      const summary =
        hotspots.length > 0
          ? `Top ${metric} hotspot: ${topIssue.path} (${topIssue.score.toFixed(2)}). ${topIssue.reason}.`
          : `No significant ${metric} hotspots found.`;

      const result = { metric, hotspots, summary };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Tool 5: get_module_structure
  server.tool(
    "get_module_structure",
    "Get the module/directory structure with cross-module dependencies and cohesion scores",
    { depth: z.number().optional().describe("Module depth (default: 2)") },
    async (_params) => {
      const modules = [...graph.moduleMetrics.values()].map((m) => ({
        path: m.path,
        files: m.files,
        loc: m.loc,
        exports: m.exports,
        internalDeps: m.internalDeps,
        externalDeps: m.externalDeps,
        cohesion: m.cohesion,
        escapeVelocity: m.escapeVelocity,
        dependsOn: m.dependsOn,
        dependedBy: m.dependedBy,
      }));

      // Cross-module dependency edges
      const crossModuleDeps: Array<{ from: string; to: string; weight: number }> = [];
      const crossMap = new Map<string, number>();

      for (const edge of graph.edges) {
        const sourceNode = graph.nodes.find((n) => n.id === edge.source);
        const targetNode = graph.nodes.find((n) => n.id === edge.target);
        if (!sourceNode || !targetNode) continue;
        if (sourceNode.module === targetNode.module) continue;

        const key = `${sourceNode.module}->${targetNode.module}`;
        crossMap.set(key, (crossMap.get(key) ?? 0) + 1);
      }

      for (const [key, weight] of crossMap) {
        const [from, to] = key.split("->");
        crossModuleDeps.push({ from, to, weight });
      }

      const result = {
        modules: modules.sort((a, b) => b.files - a.files),
        crossModuleDeps: crossModuleDeps.sort((a, b) => b.weight - a.weight),
        circularDeps: graph.stats.circularDeps.map((cycle) => ({
          cycle,
          severity: cycle.length > 3 ? "HIGH" : "LOW",
        })),
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Tool 6: analyze_forces
  server.tool(
    "analyze_forces",
    "Centrifuge force analysis: module cohesion, tension files, bridge files, and extraction candidates",
    {
      cohesionThreshold: z.number().optional().describe("Min cohesion to be 'COHESIVE' (default: 0.6)"),
      tensionThreshold: z.number().optional().describe("Min tension to flag (default: 0.3)"),
      escapeThreshold: z.number().optional().describe("Min escape velocity to flag (default: 0.5)"),
    },
    async (_params) => {
      const result = {
        moduleCohesion: graph.forceAnalysis.moduleCohesion,
        tensionFiles: graph.forceAnalysis.tensionFiles,
        bridgeFiles: graph.forceAnalysis.bridgeFiles,
        extractionCandidates: graph.forceAnalysis.extractionCandidates,
        summary: graph.forceAnalysis.summary,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
