import { NextResponse } from "next/server";
import { getGraph } from "@/src/server/graph-store";

export function GET(request: Request): NextResponse {
  const graph = getGraph();
  const url = new URL(request.url);
  const metric = url.searchParams.get("metric") ?? "coupling";
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "10", 10) || 10, 1), 100);

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
      case "churn": score = metrics.churn; break;
      case "complexity": score = metrics.cyclomaticComplexity; break;
      case "blast_radius": score = metrics.blastRadius; break;
      case "coverage": score = metrics.hasTests ? 0 : 1; break;
      default: score = 0;
    }
    scored.push({ path: filePath, score });
  }

  return NextResponse.json({
    metric,
    hotspots: scored.sort((a, b) => b.score - a.score).slice(0, limit),
  });
}
