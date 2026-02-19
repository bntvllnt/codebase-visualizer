# codebase-visualizer

3D interactive codebase visualization for TypeScript projects. Parses your codebase, builds a dependency graph, computes architectural metrics, and serves an interactive 3D map in your browser. Also works as an MCP server for LLM-assisted code understanding.

## Install

```bash
npx codebase-visualizer ./src
```

Or install globally:

```bash
npm install -g codebase-visualizer
codebase-visualizer ./src
```

## Usage

### Browser Mode (default)

```bash
npx codebase-visualizer ./src
# => Parsed 142 files, 387 functions, 612 dependencies
# => 3D map ready at http://localhost:3333
```

Opens an interactive 3D force-directed graph in your browser with 8 views, 3D module clouds, a group legend, search, detail panel, and configurable settings.

### MCP Mode (for LLMs)

```bash
npx codebase-visualizer --mcp ./src
```

Starts a stdio MCP server exposing 8 tools for LLM-assisted code understanding. No browser, no HTTP.

### CLI Options

```
codebase-visualizer <path>        # Parse and visualize
  --mcp                           # MCP stdio mode (no browser)
  --port <number>                 # Web server port (default: 3333)
  --help                          # Show help
```

## MCP Setup

### Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "codebase-visualizer": {
      "command": "npx",
      "args": ["codebase-visualizer", "--mcp", "./src"]
    }
  }
}
```

### Cursor / VS Code

Add to `.cursor/mcp.json` or `.vscode/mcp.json`:

```json
{
  "servers": {
    "codebase-visualizer": {
      "command": "npx",
      "args": ["codebase-visualizer", "--mcp", "./src"]
    }
  }
}
```

## MCP Tools

| Tool | Purpose |
|------|---------|
| `codebase_overview` | High-level architecture: modules, entry points, key metrics |
| `file_context` | Everything about one file: exports, imports, dependents, metrics |
| `get_dependents` | Blast radius: what breaks if you change this file |
| `find_hotspots` | Ranked problem files by any metric (coupling, pagerank, churn, complexity, blast_radius, coverage...) |
| `get_module_structure` | Module map with cross-deps, cohesion scores, circular deps |
| `analyze_forces` | Centrifuge analysis: cohesion, tension files, bridges, extraction candidates |
| `find_dead_exports` | Unused exports across the codebase — code that can be safely removed |
| `get_groups` | Top-level directory groups with aggregate metrics: files, LOC, importance, coupling |

## Browser Features

### 8 Views

| # | View | What It Shows |
|---|------|---------------|
| 1 | **Galaxy** (default) | 3D force-directed graph. Color = module, size = PageRank importance |
| 2 | **Dependency Flow** | DAG layout (top-to-bottom). Circular deps in red |
| 3 | **Hotspot** | Health coloring: green (healthy) to red (high coupling). Size = LOC |
| 4 | **Focus** | Click a node to see its 2-hop neighborhood. Everything else fades |
| 5 | **Module** | Files cluster by directory. Cross-module edges in yellow |
| 6 | **Forces** | Centrifuge analysis: tension (yellow), bridges (cyan), junk drawers (red), extraction candidates (green) |
| 7 | **Churn** | Git commit frequency heatmap. Red = frequently changed files |
| 8 | **Coverage** | Test coverage: green = has tests, red = untested |

### 3D Module Clouds

Transparent 3D spheres group files by top-level directory with:
- Phong shading + wireframe overlay for depth perception
- Zoom-based opacity fade (clouds disappear when camera is close)
- Smart grouping: `src/components/ui/` becomes "components", `convex/agents/eval/` becomes "convex"
- Dynamic threshold based on project size

Toggle via Settings > "Module Clouds" checkbox.

### Group Legend

Bottom-left legend shows:
- View-specific color coding
- When clouds are enabled: color swatch + group name + file count + importance percentage for each group (up to 8 groups, sorted by PageRank)

### Other UI

- **Search**: find any file by name, fly camera to it
- **Detail Panel**: click any node to see full metrics — PageRank, coupling, fan-in/out, complexity, blast radius, dead exports, test coverage
- **Settings Panel**: configure node opacity/size, link color/width, physics charge/distance, cloud opacity
- **Project Bar**: project name, file/function/dependency counts, circular dep count, tension file count

## REST API

| Endpoint | Returns |
|----------|---------|
| `GET /api/graph` | All nodes (with metrics) + edges + stats |
| `GET /api/groups` | Group metrics sorted by importance (name, files, LOC, importance, fanIn, fanOut, color) |
| `GET /api/forces` | Force analysis (cohesion, tension, bridges, extraction candidates) |
| `GET /api/modules` | Module-level metrics |
| `GET /api/hotspots?metric=coupling&limit=10` | Ranked hotspot files |
| `GET /api/file/<path>` | Single file details + metrics |
| `GET /api/meta` | Project name |
| `GET /api/ping` | Health check |
| `POST /api/mcp` | MCP tool invocation (web mode) |

## Metrics

| Metric | What It Reveals |
|--------|-----------------|
| **PageRank** | Most-referenced files (importance) |
| **Betweenness** | Bridge files connecting otherwise-disconnected modules |
| **Coupling** | How tangled a file is (fan-out / total connections) |
| **Cohesion** | Does a module belong together? (internal / total deps) |
| **Tension** | Is a file torn between modules? (entropy of cross-module pulls) |
| **Escape Velocity** | Should this module be its own package? (high external use, low internal deps) |
| **Churn** | Git commit frequency (files that change often) |
| **Cyclomatic Complexity** | Average complexity of exported functions |
| **Blast Radius** | Transitive dependents affected if this file changes |
| **Dead Exports** | Unused exports (code that can be safely removed) |
| **Test Coverage** | Whether a test file exists for each source file |

## How It Works

```
Parse (TS Compiler API) -> Build Graph (graphology) -> Analyze (metrics) -> Serve (Next.js + 3d-force-graph)
```

1. **Parser** extracts files, exported functions, and import relationships using the TypeScript Compiler API. Resolves tsconfig path aliases (`@/` imports), respects `.gitignore`, detects test file associations.
2. **Graph builder** creates nodes (files + functions) and edges (import deps + test associations) using graphology. Detects circular dependencies via iterative DFS.
3. **Analyzer** computes PageRank, betweenness centrality, coupling, cohesion, tension, escape velocity, churn, complexity, blast radius, dead exports, test coverage, and group-level aggregations.
4. **Server** serves the 3D visualization via Next.js (browser mode) or exposes graph queries via MCP stdio (LLM mode).

## Requirements

- Node.js >= 18
- TypeScript codebase (`.ts` / `.tsx` files)

## Limitations

- TypeScript only (no JavaScript CommonJS, Python, Go, etc.)
- Static analysis only (no runtime/dynamic imports)
- File-level + exported function-level granularity (no internal function calls)
- Client-side 3D rendering requires WebGL

## License

MIT
