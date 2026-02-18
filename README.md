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

Opens an interactive 3D force-directed graph in your browser with 6 views.

### MCP Mode (for LLMs)

```bash
npx codebase-visualizer --mcp ./src
```

Starts a stdio MCP server exposing 6 tools for LLM-assisted code understanding. No browser, no HTTP.

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
| `find_hotspots` | Ranked problem files by any metric (coupling, pagerank, tension...) |
| `get_module_structure` | Module map with cross-deps, cohesion scores, circular deps |
| `analyze_forces` | Centrifuge analysis: cohesion, tension files, bridges, extraction candidates |

## Browser Views

### 1. Galaxy View (default)

3D force-directed graph. Node color = module, node size = PageRank importance. First impression of the codebase shape.

### 2. Dependency Flow

DAG layout (top-to-bottom). Entry points at top, leaf dependencies at bottom. Circular dependencies highlighted in red.

### 3. Hotspot View

Health coloring: green (healthy) to red (high coupling). Node size = lines of code. Instantly shows where the problems are.

### 4. Focus View

Click any node to see its 2-hop neighborhood. Everything else fades to 10% opacity. Click another node to shift focus.

### 5. Module View

Files cluster by directory. Cross-module edges highlighted in yellow. Shows how the codebase is organized.

### 6. Force Analysis View

Centrifuge force visualization:
- **Yellow** = tension files (pulled by multiple modules)
- **Cyan** = bridge files (high betweenness centrality)
- **Red** = junk drawer modules (low cohesion)
- **Green** = extraction candidates (high escape velocity)

## Metrics

| Metric | What It Reveals |
|--------|-----------------|
| **PageRank** | Most-referenced files (importance) |
| **Betweenness** | Bridge files connecting otherwise-disconnected modules |
| **Coupling** | How tangled a file is (fan-out / total connections) |
| **Cohesion** | Does a module belong together? (internal / total deps) |
| **Tension** | Is a file torn between modules? (entropy of cross-module pulls) |
| **Escape Velocity** | Should this module be its own package? (high external use, low internal deps) |

## How It Works

```
Parse (TS Compiler API) -> Build Graph (graphology) -> Analyze (metrics) -> Serve (Express + 3d-force-graph)
```

1. **Parser** extracts files, exported functions, and import relationships using the TypeScript Compiler API
2. **Graph builder** creates nodes (files + functions) and edges (import dependencies) using graphology
3. **Analyzer** computes PageRank, betweenness centrality, coupling, cohesion, tension, and escape velocity
4. **Server** serves the 3D visualization via Express (browser mode) or exposes graph queries via MCP stdio (LLM mode)

## Requirements

- Node.js >= 18
- TypeScript codebase (`.ts` / `.tsx` files)

## Limitations (v0.1.0)

- TypeScript only (no JavaScript CommonJS, Python, Go, etc.)
- Static analysis only (no runtime/dynamic imports)
- File-level + exported function-level granularity (no internal function calls)
- No file watching / hot reload
- Client-side 3D rendering requires WebGL

## License

MIT
