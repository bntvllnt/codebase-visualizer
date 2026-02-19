import { test, expect } from "@playwright/test";

test.describe("API Routes", () => {
  test("GET /api/ping returns ok", async ({ request }) => {
    const res = await request.get("/api/ping");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  test("GET /api/meta returns project name", async ({ request }) => {
    const res = await request.get("/api/meta");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.projectName).toBe("e2e-fixture-project");
  });

  test("GET /api/graph returns nodes, edges, stats", async ({ request }) => {
    const res = await request.get("/api/graph");
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(Array.isArray(body.nodes)).toBe(true);
    expect(Array.isArray(body.edges)).toBe(true);
    expect(body.stats).toBeDefined();
    expect(body.stats.totalFiles).toBe(10);
    expect(body.stats.totalFunctions).toBeGreaterThan(0);
    expect(body.stats.totalDependencies).toBeGreaterThan(0);
    expect(Array.isArray(body.stats.circularDeps)).toBe(true);
    expect(body.stats.circularDeps.length).toBeGreaterThan(0);

    // Verify node shape
    const fileNode = body.nodes.find((n: { type: string }) => n.type === "file");
    expect(fileNode).toBeDefined();
    expect(fileNode.id).toBeDefined();
    expect(fileNode.path).toBeDefined();
    expect(fileNode.module).toBeDefined();
    expect(typeof fileNode.loc).toBe("number");
    expect(typeof fileNode.pageRank).toBe("number");
    expect(typeof fileNode.betweenness).toBe("number");
    expect(typeof fileNode.coupling).toBe("number");
    expect(typeof fileNode.fanIn).toBe("number");
    expect(typeof fileNode.fanOut).toBe("number");
    expect(typeof fileNode.churn).toBe("number");
    expect(typeof fileNode.cyclomaticComplexity).toBe("number");
    expect(typeof fileNode.blastRadius).toBe("number");
    expect(Array.isArray(fileNode.deadExports)).toBe(true);
    expect(typeof fileNode.hasTests).toBe("boolean");
    expect(Array.isArray(fileNode.functions)).toBe(true);
  });

  test("GET /api/modules returns module structure", async ({ request }) => {
    const res = await request.get("/api/modules");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.modules)).toBe(true);
    expect(body.modules.length).toBeGreaterThan(0);

    const mod = body.modules[0];
    expect(mod.path).toBeDefined();
    expect(typeof mod.files).toBe("number");
    expect(typeof mod.cohesion).toBe("number");
  });

  test("GET /api/forces returns force analysis", async ({ request }) => {
    const res = await request.get("/api/forces");
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(Array.isArray(body.moduleCohesion)).toBe(true);
    expect(Array.isArray(body.tensionFiles)).toBe(true);
    expect(Array.isArray(body.bridgeFiles)).toBe(true);
    expect(Array.isArray(body.extractionCandidates)).toBe(true);
    expect(typeof body.summary).toBe("string");
  });

  test("GET /api/hotspots returns hotspots (default)", async ({ request }) => {
    const res = await request.get("/api/hotspots");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.metric).toBe("coupling");
    expect(Array.isArray(body.hotspots)).toBe(true);
  });

  test("GET /api/hotspots?metric=complexity returns sorted results", async ({ request }) => {
    const res = await request.get("/api/hotspots?metric=complexity&limit=5");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.metric).toBe("complexity");
    expect(Array.isArray(body.hotspots)).toBe(true);
    expect(body.hotspots.length).toBeLessThanOrEqual(5);
  });

  test("GET /api/file/[path] returns file details", async ({ request }) => {
    // Use a file path from the fixture project
    const graphRes = await request.get("/api/graph");
    const graph = await graphRes.json();
    const firstFile = graph.nodes.find((n: { type: string }) => n.type === "file");
    expect(firstFile).toBeDefined();

    const res = await request.get(`/api/file/${firstFile.id}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.path).toBe(firstFile.id);
    expect(typeof body.loc).toBe("number");
    expect(Array.isArray(body.functions)).toBe(true);
    expect(Array.isArray(body.imports)).toBe(true);
    expect(Array.isArray(body.dependents)).toBe(true);
    expect(body.metrics).toBeDefined();
  });

  test("GET /api/file/nonexistent returns 404", async ({ request }) => {
    const res = await request.get("/api/file/this/does/not/exist.ts");
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
