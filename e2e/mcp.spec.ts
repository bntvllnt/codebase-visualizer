import { test, expect } from "@playwright/test";

test.describe("MCP API", () => {
  test("GET /api/mcp lists all 7 tools", async ({ request }) => {
    const res = await request.get("/api/mcp");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.tools)).toBe(true);
    expect(body.tools.length).toBe(7);

    const names = body.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("codebase_overview");
    expect(names).toContain("file_context");
    expect(names).toContain("get_dependents");
    expect(names).toContain("find_hotspots");
    expect(names).toContain("get_module_structure");
    expect(names).toContain("analyze_forces");
    expect(names).toContain("find_dead_exports");
  });

  test("POST codebase_overview returns structure", async ({ request }) => {
    const res = await request.post("/api/mcp", {
      data: { tool: "codebase_overview" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.content).toBeDefined();
    expect(body.content[0].type).toBe("text");

    const data = JSON.parse(body.content[0].text);
    expect(data.totalFiles).toBe(10);
    expect(data.totalFunctions).toBeGreaterThan(0);
    expect(Array.isArray(data.modules)).toBe(true);
    expect(data.metrics.circularDeps).toBeGreaterThan(0);
  });

  test("POST file_context returns file details", async ({ request }) => {
    // Get a valid file path first
    const graphRes = await request.get("/api/graph");
    const graph = await graphRes.json();
    const filePath = graph.nodes.find((n: { type: string }) => n.type === "file").id;

    const res = await request.post("/api/mcp", {
      data: { tool: "file_context", params: { filePath } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = JSON.parse(body.content[0].text);
    expect(data.path).toBe(filePath);
    expect(data.metrics).toBeDefined();
    expect(typeof data.metrics.pageRank).toBe("number");
  });

  test("POST file_context with invalid path returns error", async ({ request }) => {
    const res = await request.post("/api/mcp", {
      data: { tool: "file_context", params: { filePath: "nonexistent.ts" } },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.isError).toBe(true);
  });

  test("POST get_dependents returns blast radius", async ({ request }) => {
    const graphRes = await request.get("/api/graph");
    const graph = await graphRes.json();
    const filePath = graph.nodes.find((n: { type: string }) => n.type === "file").id;

    const res = await request.post("/api/mcp", {
      data: { tool: "get_dependents", params: { filePath } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = JSON.parse(body.content[0].text);
    expect(data.file).toBe(filePath);
    expect(Array.isArray(data.directDependents)).toBe(true);
    expect(typeof data.totalAffected).toBe("number");
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(data.riskLevel);
  });

  test("POST find_hotspots by coupling", async ({ request }) => {
    const res = await request.post("/api/mcp", {
      data: { tool: "find_hotspots", params: { metric: "coupling", limit: 5 } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = JSON.parse(body.content[0].text);
    expect(data.metric).toBe("coupling");
    expect(Array.isArray(data.hotspots)).toBe(true);
    expect(data.hotspots.length).toBeLessThanOrEqual(5);
    expect(typeof data.summary).toBe("string");
  });

  test("POST find_hotspots by complexity", async ({ request }) => {
    const res = await request.post("/api/mcp", {
      data: { tool: "find_hotspots", params: { metric: "complexity" } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = JSON.parse(body.content[0].text);
    expect(data.metric).toBe("complexity");
    expect(Array.isArray(data.hotspots)).toBe(true);
  });

  test("POST find_hotspots by coverage", async ({ request }) => {
    const res = await request.post("/api/mcp", {
      data: { tool: "find_hotspots", params: { metric: "coverage" } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = JSON.parse(body.content[0].text);
    expect(data.metric).toBe("coverage");
  });

  test("POST get_module_structure returns modules + cross-deps", async ({ request }) => {
    const res = await request.post("/api/mcp", {
      data: { tool: "get_module_structure" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = JSON.parse(body.content[0].text);
    expect(Array.isArray(data.modules)).toBe(true);
    expect(data.modules.length).toBeGreaterThan(0);
    expect(Array.isArray(data.crossModuleDeps)).toBe(true);
    expect(Array.isArray(data.circularDeps)).toBe(true);
  });

  test("POST analyze_forces returns force analysis", async ({ request }) => {
    const res = await request.post("/api/mcp", {
      data: { tool: "analyze_forces" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = JSON.parse(body.content[0].text);
    expect(Array.isArray(data.moduleCohesion)).toBe(true);
    expect(Array.isArray(data.tensionFiles)).toBe(true);
    expect(Array.isArray(data.bridgeFiles)).toBe(true);
    expect(typeof data.summary).toBe("string");
  });

  test("POST find_dead_exports returns unused exports", async ({ request }) => {
    const res = await request.post("/api/mcp", {
      data: { tool: "find_dead_exports" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = JSON.parse(body.content[0].text);
    expect(typeof data.totalDeadExports).toBe("number");
    expect(Array.isArray(data.files)).toBe(true);
    // Fixture project has dead exports
    expect(data.totalDeadExports).toBeGreaterThan(0);
  });

  test("POST with invalid tool name returns error", async ({ request }) => {
    const res = await request.post("/api/mcp", {
      data: { tool: "nonexistent_tool" },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.isError).toBe(true);
  });

  test("POST with missing tool field returns 400", async ({ request }) => {
    const res = await request.post("/api/mcp", {
      data: { params: {} },
    });
    expect(res.status()).toBe(400);
  });

  test("POST with invalid JSON returns 400", async ({ request }) => {
    const res = await request.post("/api/mcp", {
      data: "not json",
      headers: { "Content-Type": "text/plain" },
    });
    expect(res.status()).toBe(400);
  });
});
