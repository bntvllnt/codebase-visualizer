import type { CodebaseGraph } from "../types/index.js";

declare global {
   
  var __codebaseGraph: CodebaseGraph | undefined;
   
  var __projectName: string | undefined;
}

export function setGraph(graph: CodebaseGraph, projectName: string): void {
  globalThis.__codebaseGraph = graph;
  globalThis.__projectName = projectName;
}

export function getGraph(): CodebaseGraph {
  if (!globalThis.__codebaseGraph) {
    throw new Error("Graph not initialized. Run the CLI to parse a codebase first.");
  }
  return globalThis.__codebaseGraph;
}

export function getProjectName(): string {
  return globalThis.__projectName ?? "unknown";
}
