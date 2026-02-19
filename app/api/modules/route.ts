import { NextResponse } from "next/server";
import { getGraph } from "@/src/server/graph-store";

export function GET(): NextResponse {
  const graph = getGraph();
  const modules = [...graph.moduleMetrics.values()];
  return NextResponse.json({ modules });
}
