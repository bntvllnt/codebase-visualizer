import { Router, type Request, type Response } from "express";
import type { CodebaseGraph } from "../types/index.js";

export function createApiRoutes(graph: CodebaseGraph): Router {
  const router = Router();

  // Full graph data for 3D renderer
  router.get("/graph", (_req, res) => {
    const fileNodes = graph.nodes.filter((n) => n.type === "file");
    const functionNodes = graph.nodes.filter((n) => n.type === "function");

    const nodes = fileNodes.map((n) => {
      const metrics = graph.fileMetrics.get(n.id);
      return {
        id: n.id,
        type: n.type,
        label: n.label,
        path: n.path,
        loc: n.loc,
        module: n.module,
        pageRank: metrics?.pageRank ?? 0,
        betweenness: metrics?.betweenness ?? 0,
        coupling: metrics?.coupling ?? 0,
        fanIn: metrics?.fanIn ?? 0,
        fanOut: metrics?.fanOut ?? 0,
        tension: metrics?.tension ?? 0,
        isBridge: metrics?.isBridge ?? false,
        functions: functionNodes
          .filter((fn) => fn.parentFile === n.id)
          .map((fn) => ({ name: fn.label, loc: fn.loc })),
      };
    });

    const edges = graph.edges.map((e) => ({
      source: e.source,
      target: e.target,
      symbols: e.symbols,
      isTypeOnly: e.isTypeOnly,
      weight: e.weight,
    }));

    res.json({ nodes, edges, stats: graph.stats });
  });

  // File detail
  router.get("/file/*", (req: Request, res: Response) => {
    const filePath = (req.params as Record<string, string>)[0];
    const metrics = graph.fileMetrics.get(filePath);
    if (!metrics) {
      res.status(404).json({ error: `File not found in graph: ${filePath}` });
      return;
    }

    const node = graph.nodes.find((n) => n.id === filePath);
    const imports = graph.edges.filter((e) => e.source === filePath);
    const dependents = graph.edges.filter((e) => e.target === filePath);
    const functions = graph.nodes.filter((n) => n.parentFile === filePath);

    res.json({
      path: filePath,
      loc: node?.loc ?? 0,
      module: node?.module ?? "",
      functions: functions.map((f) => ({ name: f.label, loc: f.loc })),
      imports: imports.map((e) => ({ from: e.target, symbols: e.symbols })),
      dependents: dependents.map((e) => ({ path: e.source, symbols: e.symbols })),
      metrics,
    });
  });

  // Modules
  router.get("/modules", (_req, res) => {
    const modules = [...graph.moduleMetrics.values()];
    res.json({ modules });
  });

  // Hotspots
  router.get("/hotspots", (req, res) => {
    const metric = (req.query.metric as string) || "coupling";
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const scored: Array<{ path: string; score: number }> = [];
    for (const [filePath, metrics] of graph.fileMetrics) {
      let score: number;
      switch (metric) {
        case "coupling": score = metrics.coupling; break;
        case "pagerank": score = metrics.pageRank; break;
        case "fan_in": score = metrics.fanIn; break;
        case "fan_out": score = metrics.fanOut; break;
        case "betweenness": score = metrics.betweenness; break;
        case "tension": score = metrics.tension; break;
        default: score = 0;
      }
      scored.push({ path: filePath, score });
    }

    res.json({ metric, hotspots: scored.sort((a, b) => b.score - a.score).slice(0, limit) });
  });

  // Force analysis
  router.get("/forces", (_req, res) => {
    res.json(graph.forceAnalysis);
  });

  return router;
}
