# Architecture

## Pipeline

```
CLI (commander)
  |
  v
Parser (TS Compiler API)
  | extracts: files, exports, imports, LOC, complexity, churn, test mapping
  v
Graph Builder (graphology)
  | creates: nodes (file + function), edges (imports with symbols/weights)
  | detects: circular dependencies (iterative DFS)
  v
Analyzer
  | computes: PageRank, betweenness, coupling, tension, cohesion
  | computes: churn, complexity, blast radius, dead exports, test coverage
  | produces: ForceAnalysis (tension files, bridges, extraction candidates)
  v
Server (Express) or MCP (stdio)
  | serves: REST API + static 3D UI  OR  MCP tools for LLMs
```

## Module Map

```
src/
  types/index.ts       <- ALL interfaces (single source of truth)
  parser/index.ts      <- TS AST extraction + git churn + test detection
  graph/index.ts       <- graphology graph + circular dep detection
  analyzer/index.ts    <- All metric computation
  mcp/index.ts         <- 7 MCP tools for LLM integration
  server/index.ts      <- Express setup + port fallback
  server/api.ts        <- REST API routes (8 endpoints)
  cli.ts               <- Entry point, wires pipeline together
public/
  index.html           <- 8-view 3D client (3d-force-graph + Three.js)
```

## Data Flow

```
parseCodebase(rootDir)
  -> ParsedFile[] (with churn, complexity, test mapping)

buildGraph(parsedFiles)
  -> BuiltGraph { graph: Graph, nodes: GraphNode[], edges: GraphEdge[] }

analyzeGraph(builtGraph, parsedFiles)
  -> CodebaseGraph {
       nodes, edges, fileMetrics, moduleMetrics, forceAnalysis, stats
     }

startServer(codebaseGraph, port, projectName)
  -> Express app serving /api/* + static /public/

startMcpServer(codebaseGraph)
  -> stdio MCP server with 7 tools
```

## Key Design Decisions

- **Single HTML file**: No build step for client. CDN for 3d-force-graph + Three.js. Keeps iteration fast.
- **graphology**: In-memory graph with O(1) neighbor lookup. PageRank and betweenness computed via graphology-metrics.
- **Batch git churn**: Single `git log --all --name-only` call, parsed for all files. Avoids O(n) subprocess spawning.
- **Dead export detection**: Cross-references parsed exports against edge symbol lists. May miss `import *` or re-exports (known limitation).
- **Graceful degradation**: Non-git dirs get churn=0, no-test codebases get coverage=false. Never crashes.

## Adding a New Metric

Vertical slice through all layers:

1. **types/index.ts** — Add field to `FileMetrics` (and `ParsedFile`/`ParsedExport` if extracted at parse time)
2. **parser/index.ts** — Extract raw data from AST or external source (git, filesystem)
3. **analyzer/index.ts** — Compute derived metric, store in `fileMetrics` map
4. **mcp/index.ts** — Expose via `find_hotspots` enum or new tool
5. **server/api.ts** — Add to `/graph` node shape and `/hotspots` switch
6. **public/index.html** — Add view tab + render function + detail panel row + legend
7. **Tests** — Cover parser extraction + analyzer computation
