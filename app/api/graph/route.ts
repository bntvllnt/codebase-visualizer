import { NextResponse } from "next/server";
import { getGraph } from "@/src/server/graph-store";

export function GET(): NextResponse {
  const graph = getGraph();
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
      churn: metrics?.churn ?? 0,
      cyclomaticComplexity: metrics?.cyclomaticComplexity ?? 1,
      blastRadius: metrics?.blastRadius ?? 0,
      deadExports: metrics?.deadExports ?? [],
      hasTests: metrics?.hasTests ?? false,
      testFile: metrics?.testFile ?? "",
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

  return NextResponse.json({ nodes, edges, stats: graph.stats });
}
