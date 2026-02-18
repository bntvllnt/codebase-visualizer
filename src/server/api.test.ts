import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";
import { createApiRoutes } from "./api.js";
import { buildGraph } from "../graph/index.js";
import { analyzeGraph } from "../analyzer/index.js";
import type { CodebaseGraph } from "../types/index.js";
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

let app: express.Application;
let graph: CodebaseGraph;

beforeAll(() => {
  // Build a real graph from test data — zero mocking
  const files = [
    makeFile("src/core/utils.ts", {
      loc: 50,
      exports: [
        { name: "add", type: "function", loc: 5, isDefault: false, complexity: 1 },
        { name: "subtract", type: "function", loc: 5, isDefault: false, complexity: 1 },
      ],
      imports: [],
    }),
    makeFile("src/core/types.ts", {
      loc: 30,
      exports: [
        { name: "Config", type: "interface", loc: 8, isDefault: false, complexity: 1 },
      ],
    }),
    makeFile("src/api/handler.ts", {
      loc: 80,
      exports: [
        { name: "handleRequest", type: "function", loc: 20, isDefault: false, complexity: 1 },
      ],
      imports: [
        imp("src/core/utils.ts", ["add", "subtract"]),
        imp("src/core/types.ts", ["Config"], true),
      ],
    }),
    makeFile("src/api/router.ts", {
      loc: 40,
      exports: [
        { name: "createRouter", type: "function", loc: 10, isDefault: false, complexity: 1 },
      ],
      imports: [imp("src/api/handler.ts", ["handleRequest"])],
    }),
    makeFile("src/index.ts", {
      loc: 20,
      imports: [
        imp("src/api/router.ts", ["createRouter"]),
        imp("src/core/utils.ts", ["add"]),
      ],
    }),
  ];

  const built = buildGraph(files);
  graph = analyzeGraph(built);

  app = express();
  app.use("/api", createApiRoutes(graph));
});

describe("GET /api/graph", () => {
  it("returns nodes, edges, and stats", async () => {
    const res = await request(app).get("/api/graph");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("nodes");
    expect(res.body).toHaveProperty("edges");
    expect(res.body).toHaveProperty("stats");
  });

  it("returns only file nodes (not function nodes)", async () => {
    const res = await request(app).get("/api/graph");
    const nodes = res.body.nodes as Array<{ type: string }>;
    expect(nodes.every((n) => n.type === "file")).toBe(true);
    expect(nodes).toHaveLength(5);
  });

  it("includes metrics on each node", async () => {
    const res = await request(app).get("/api/graph");
    const nodes = res.body.nodes as Array<Record<string, unknown>>;
    for (const node of nodes) {
      expect(node).toHaveProperty("pageRank");
      expect(node).toHaveProperty("betweenness");
      expect(node).toHaveProperty("coupling");
      expect(node).toHaveProperty("fanIn");
      expect(node).toHaveProperty("fanOut");
      expect(node).toHaveProperty("tension");
      expect(node).toHaveProperty("isBridge");
    }
  });

  it("includes functions array on file nodes", async () => {
    const res = await request(app).get("/api/graph");
    const utils = (res.body.nodes as Array<{ id: string; functions: unknown[] }>)
      .find((n) => n.id === "src/core/utils.ts");
    expect(utils?.functions).toHaveLength(2);
  });

  it("returns correct stats", async () => {
    const res = await request(app).get("/api/graph");
    expect(res.body.stats.totalFiles).toBe(5);
    expect(res.body.stats.totalDependencies).toBeGreaterThan(0);
  });
});

describe("GET /api/file/*", () => {
  it("returns file detail for existing file", async () => {
    const res = await request(app).get("/api/file/src/core/utils.ts");

    expect(res.status).toBe(200);
    expect(res.body.path).toBe("src/core/utils.ts");
    expect(res.body).toHaveProperty("loc");
    expect(res.body).toHaveProperty("module");
    expect(res.body).toHaveProperty("functions");
    expect(res.body).toHaveProperty("imports");
    expect(res.body).toHaveProperty("dependents");
    expect(res.body).toHaveProperty("metrics");
  });

  it("returns 404 for nonexistent file", async () => {
    const res = await request(app).get("/api/file/nonexistent.ts");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toContain("not found");
  });

  it("returns correct imports for a file", async () => {
    const res = await request(app).get("/api/file/src/api/handler.ts");

    expect(res.body.imports).toHaveLength(2);
    const importTargets = (res.body.imports as Array<{ from: string }>).map((i) => i.from);
    expect(importTargets).toContain("src/core/utils.ts");
    expect(importTargets).toContain("src/core/types.ts");
  });

  it("returns correct dependents for a file", async () => {
    const res = await request(app).get("/api/file/src/core/utils.ts");

    // utils.ts is imported by handler.ts and index.ts
    const depPaths = (res.body.dependents as Array<{ path: string }>).map((d) => d.path);
    expect(depPaths).toContain("src/api/handler.ts");
    expect(depPaths).toContain("src/index.ts");
  });

  it("returns functions for a file with exports", async () => {
    const res = await request(app).get("/api/file/src/core/utils.ts");
    const funcNames = (res.body.functions as Array<{ name: string }>).map((f) => f.name);
    expect(funcNames).toContain("add");
    expect(funcNames).toContain("subtract");
  });

  it("returns metrics object", async () => {
    const res = await request(app).get("/api/file/src/core/utils.ts");
    const metrics = res.body.metrics;

    expect(typeof metrics.pageRank).toBe("number");
    expect(typeof metrics.betweenness).toBe("number");
    expect(typeof metrics.coupling).toBe("number");
    expect(typeof metrics.fanIn).toBe("number");
    expect(typeof metrics.fanOut).toBe("number");
  });
});

describe("GET /api/modules", () => {
  it("returns all modules", async () => {
    const res = await request(app).get("/api/modules");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("modules");
    expect(res.body.modules.length).toBeGreaterThan(0);
  });

  it("includes cohesion and escape velocity", async () => {
    const res = await request(app).get("/api/modules");
    const modules = res.body.modules as Array<Record<string, unknown>>;

    for (const mod of modules) {
      expect(mod).toHaveProperty("cohesion");
      expect(mod).toHaveProperty("escapeVelocity");
      expect(mod).toHaveProperty("files");
      expect(mod).toHaveProperty("loc");
    }
  });
});

describe("GET /api/hotspots", () => {
  it("returns hotspots sorted by coupling (default)", async () => {
    const res = await request(app).get("/api/hotspots");

    expect(res.status).toBe(200);
    expect(res.body.metric).toBe("coupling");
    expect(res.body.hotspots.length).toBeGreaterThan(0);

    // Verify sorted descending
    const scores = (res.body.hotspots as Array<{ score: number }>).map((h) => h.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it("supports metric=pagerank", async () => {
    const res = await request(app).get("/api/hotspots?metric=pagerank");
    expect(res.body.metric).toBe("pagerank");
  });

  it("supports metric=fan_in", async () => {
    const res = await request(app).get("/api/hotspots?metric=fan_in");
    expect(res.body.metric).toBe("fan_in");
  });

  it("supports metric=fan_out", async () => {
    const res = await request(app).get("/api/hotspots?metric=fan_out");
    expect(res.body.metric).toBe("fan_out");
  });

  it("supports metric=betweenness", async () => {
    const res = await request(app).get("/api/hotspots?metric=betweenness");
    expect(res.body.metric).toBe("betweenness");
  });

  it("supports metric=tension", async () => {
    const res = await request(app).get("/api/hotspots?metric=tension");
    expect(res.body.metric).toBe("tension");
  });

  it("respects limit parameter", async () => {
    const res = await request(app).get("/api/hotspots?limit=2");
    expect(res.body.hotspots).toHaveLength(2);
  });

  it("defaults score to 0 for unknown metric", async () => {
    const res = await request(app).get("/api/hotspots?metric=unknown_metric");
    const scores = (res.body.hotspots as Array<{ score: number }>).map((h) => h.score);
    expect(scores.every((s) => s === 0)).toBe(true);
  });
});

describe("GET /api/forces", () => {
  it("returns force analysis", async () => {
    const res = await request(app).get("/api/forces");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("moduleCohesion");
    expect(res.body).toHaveProperty("tensionFiles");
    expect(res.body).toHaveProperty("bridgeFiles");
    expect(res.body).toHaveProperty("extractionCandidates");
    expect(res.body).toHaveProperty("summary");
  });

  it("module cohesion entries have verdicts", async () => {
    const res = await request(app).get("/api/forces");
    const cohesion = res.body.moduleCohesion as Array<{ verdict: string }>;
    for (const mod of cohesion) {
      expect(["COHESIVE", "MODERATE", "JUNK_DRAWER"]).toContain(mod.verdict);
    }
  });
});
