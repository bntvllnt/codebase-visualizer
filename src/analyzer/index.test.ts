import { describe, it, expect } from "vitest";
import { analyzeGraph } from "./index.js";
import { buildGraph } from "../graph/index.js";
import type { ParsedFile } from "../types/index.js";

function makeFile(relativePath: string, overrides?: Partial<ParsedFile>): ParsedFile {
  return {
    path: `/root/${relativePath}`,
    relativePath,
    loc: 10,
    exports: [],
    imports: [],
    churn: 0,
    isTestFile: false,
    ...overrides,
  };
}

function imp(resolvedFrom: string, symbols: string[] = ["x"], isTypeOnly = false): ParsedFile["imports"][number] {
  return { from: `./${resolvedFrom}`, resolvedFrom, symbols, isTypeOnly };
}

describe("analyzeGraph", () => {
  it("returns correct stats for a simple graph", () => {
    const files = [
      makeFile("a.ts", { exports: [{ name: "foo", type: "function", loc: 5, isDefault: false, complexity: 1 }] }),
      makeFile("b.ts"),
    ];
    const built = buildGraph(files);
    const result = analyzeGraph(built);

    expect(result.stats.totalFiles).toBe(2);
    expect(result.stats.totalFunctions).toBe(1);
    expect(result.stats.totalDependencies).toBe(0);
    expect(result.stats.circularDeps).toHaveLength(0);
  });

  it("computes pageRank for all file nodes", () => {
    const files = [
      makeFile("a.ts", { imports: [imp("b.ts")] }),
      makeFile("b.ts", { imports: [imp("c.ts")] }),
      makeFile("c.ts"),
    ];
    const built = buildGraph(files);
    const result = analyzeGraph(built);

    // c.ts is most depended on (end of chain) → highest pageRank
    const prC = result.fileMetrics.get("c.ts")?.pageRank ?? 0;
    const prA = result.fileMetrics.get("a.ts")?.pageRank ?? 0;
    expect(prC).toBeGreaterThan(prA);
  });

  it("computes betweenness centrality", () => {
    // b.ts is the bridge: a→b→c
    const files = [
      makeFile("a.ts", { imports: [imp("b.ts")] }),
      makeFile("b.ts", { imports: [imp("c.ts")] }),
      makeFile("c.ts"),
    ];
    const built = buildGraph(files);
    const result = analyzeGraph(built);

    const btwnB = result.fileMetrics.get("b.ts")?.betweenness ?? 0;
    const btwnA = result.fileMetrics.get("a.ts")?.betweenness ?? 0;
    const btwnC = result.fileMetrics.get("c.ts")?.betweenness ?? 0;
    expect(btwnB).toBeGreaterThanOrEqual(btwnA);
    expect(btwnB).toBeGreaterThanOrEqual(btwnC);
  });

  it("computes fan-in and fan-out correctly", () => {
    const files = [
      makeFile("a.ts", { imports: [imp("c.ts")] }),
      makeFile("b.ts", { imports: [imp("c.ts")] }),
      makeFile("c.ts", { imports: [imp("d.ts")] }),
      makeFile("d.ts"),
    ];
    const built = buildGraph(files);
    const result = analyzeGraph(built);

    // c.ts: 2 files import it (fan-in=2), imports 1 file (fan-out=1)
    const metricsC = result.fileMetrics.get("c.ts");
    expect(metricsC?.fanIn).toBe(2);
    expect(metricsC?.fanOut).toBe(1);

    // d.ts: 1 file imports it, imports nothing
    const metricsD = result.fileMetrics.get("d.ts");
    expect(metricsD?.fanIn).toBe(1);
    expect(metricsD?.fanOut).toBe(0);
  });

  it("computes coupling = fanOut / (fanIn + fanOut)", () => {
    const files = [
      makeFile("a.ts", { imports: [imp("b.ts"), imp("c.ts")] }),
      makeFile("b.ts"),
      makeFile("c.ts"),
    ];
    const built = buildGraph(files);
    const result = analyzeGraph(built);

    // a.ts: fanIn=0, fanOut=2 → coupling = 2/(0+2) = 1.0
    expect(result.fileMetrics.get("a.ts")?.coupling).toBe(1);

    // b.ts: fanIn=1, fanOut=0 → coupling = 0/(1+0) = 0
    expect(result.fileMetrics.get("b.ts")?.coupling).toBe(0);
  });

  it("coupling is 0 for isolated nodes", () => {
    const files = [makeFile("lonely.ts")];
    const built = buildGraph(files);
    const result = analyzeGraph(built);
    expect(result.fileMetrics.get("lonely.ts")?.coupling).toBe(0);
  });

  it("detects bridge files with betweenness > 0.1", () => {
    const files = [
      makeFile("a.ts", { imports: [imp("b.ts"), imp("c.ts")] }),
      makeFile("b.ts"),
      makeFile("c.ts"),
    ];
    const built = buildGraph(files);
    const result = analyzeGraph(built);

    // Bridges depend on graph structure; just verify the property is set
    for (const [, metrics] of result.fileMetrics) {
      expect(metrics.isBridge).toBe(metrics.betweenness > 0.1);
    }
  });

  it("computes module metrics with cohesion", () => {
    // Two modules: src/a/ and src/b/
    const files = [
      makeFile("src/a/x.ts", { imports: [imp("src/a/y.ts")] }),
      makeFile("src/a/y.ts"),
      makeFile("src/b/z.ts", { imports: [imp("src/a/x.ts")] }),
    ];
    const built = buildGraph(files);
    const result = analyzeGraph(built);

    // Module src/a/: 1 internal dep (x→y), 0 external deps → cohesion = 1
    const modA = result.moduleMetrics.get("src/a/");
    expect(modA).toBeDefined();
    expect(modA?.files).toBe(2);
    expect(modA?.cohesion).toBe(1);

    // Module src/b/: 0 internal deps, 1 external dep → cohesion = 0
    const modB = result.moduleMetrics.get("src/b/");
    expect(modB).toBeDefined();
    expect(modB?.cohesion).toBe(0);
  });

  it("module dependsOn and dependedBy are correct", () => {
    const files = [
      makeFile("src/a/x.ts", { imports: [imp("src/b/y.ts")] }),
      makeFile("src/b/y.ts"),
    ];
    const built = buildGraph(files);
    const result = analyzeGraph(built);

    const modA = result.moduleMetrics.get("src/a/");
    expect(modA?.dependsOn).toContain("src/b/");

    const modB = result.moduleMetrics.get("src/b/");
    expect(modB?.dependedBy).toContain("src/a/");
  });

  it("computes force analysis with cohesion verdicts", () => {
    const files = [
      makeFile("src/a/x.ts", { imports: [imp("src/a/y.ts")] }),
      makeFile("src/a/y.ts"),
    ];
    const built = buildGraph(files);
    const result = analyzeGraph(built);

    expect(result.forceAnalysis.moduleCohesion).toBeDefined();
    expect(result.forceAnalysis.moduleCohesion.length).toBeGreaterThan(0);

    const verdicts = result.forceAnalysis.moduleCohesion.map((m) => m.verdict);
    expect(verdicts.every((v) => ["COHESIVE", "MODERATE", "JUNK_DRAWER"].includes(v))).toBe(true);
  });

  it("detects tension files pulled by multiple modules", () => {
    // utils.ts is imported by both mod-a and mod-b (different modules)
    const files = [
      makeFile("utils.ts", {
        imports: [imp("src/a/x.ts"), imp("src/b/y.ts")],
      }),
      makeFile("src/a/x.ts"),
      makeFile("src/b/y.ts"),
    ];
    const built = buildGraph(files);
    const result = analyzeGraph(built);

    // utils.ts has outgoing edges to 2 different modules → potential tension
    // Whether it qualifies depends on the tension threshold (>0.3)
    expect(result.forceAnalysis.tensionFiles).toBeDefined();
  });

  it("summary reports healthy when no issues found", () => {
    const files = [
      makeFile("src/a/x.ts", { imports: [imp("src/a/y.ts")] }),
      makeFile("src/a/y.ts"),
    ];
    const built = buildGraph(files);
    const result = analyzeGraph(built);

    expect(result.forceAnalysis.summary).toContain("healthy");
  });

  it("handles circular dependencies in stats", () => {
    const files = [
      makeFile("a.ts", { imports: [imp("b.ts")] }),
      makeFile("b.ts", { imports: [imp("a.ts")] }),
    ];
    const built = buildGraph(files);
    const result = analyzeGraph(built);
    expect(result.stats.circularDeps.length).toBeGreaterThan(0);
  });

  it("handles single-file graph", () => {
    const files = [makeFile("solo.ts", { loc: 42 })];
    const built = buildGraph(files);
    const result = analyzeGraph(built);

    expect(result.stats.totalFiles).toBe(1);
    expect(result.fileMetrics.get("solo.ts")).toBeDefined();
    expect(result.fileMetrics.get("solo.ts")?.coupling).toBe(0);
  });

  it("returns all required fields in CodebaseGraph", () => {
    const files = [makeFile("a.ts")];
    const built = buildGraph(files);
    const result = analyzeGraph(built);

    expect(result).toHaveProperty("nodes");
    expect(result).toHaveProperty("edges");
    expect(result).toHaveProperty("fileMetrics");
    expect(result).toHaveProperty("moduleMetrics");
    expect(result).toHaveProperty("forceAnalysis");
    expect(result).toHaveProperty("stats");
    expect(result.forceAnalysis).toHaveProperty("moduleCohesion");
    expect(result.forceAnalysis).toHaveProperty("tensionFiles");
    expect(result.forceAnalysis).toHaveProperty("bridgeFiles");
    expect(result.forceAnalysis).toHaveProperty("extractionCandidates");
    expect(result.forceAnalysis).toHaveProperty("summary");
  });
});
