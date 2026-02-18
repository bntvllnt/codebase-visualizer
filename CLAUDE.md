# Codebase Visualizer - Claude Code Rules

## Project Overview

npm package that generates 3D interactive maps of TypeScript codebases. Two modes: browser (3D visualization) and MCP stdio (LLM integration).

## Architecture

```
src/
  types/index.ts      <- All TypeScript interfaces (single source of truth)
  parser/index.ts     <- TS Compiler API parser (files, functions, imports)
  graph/index.ts      <- graphology graph builder + circular dep detection
  analyzer/index.ts   <- Metrics engine (PageRank, betweenness, cohesion, tension, escape velocity)
  mcp/index.ts        <- MCP stdio server (6 tools)
  server/index.ts     <- Express web server
  server/api.ts       <- REST API routes
  cli.ts              <- CLI entry point (commander)
public/
  index.html          <- Client-side 3D renderer (6 views, uses 3d-force-graph from CDN)
specs/
  active/             <- Current spec
```

## Pipeline

```
CLI args -> Parser (TS AST) -> Graph Builder (graphology) -> Analyzer (metrics) -> Server (Express | MCP stdio)
```

## Key Conventions

### TypeScript
- ESM modules (`"type": "module"`)
- Bundler module resolution
- Strict mode enabled
- All internal imports use `.js` extension (ESM convention)
- Types defined in `src/types/index.ts` — import from there, never duplicate
- `import type` for type-only imports (enforced by ESLint)

### Dependencies
- **graphology** — graph data structure. Import as `import Graph from "graphology"`. Use as both constructor and type.
- **graphology-metrics** — PageRank, betweenness. Default imports from subpaths.
- **@modelcontextprotocol/sdk** — MCP server. Uses `McpServer` class with `server.tool()` registration.
- **express** — web server. Routes in `server/api.ts`, static files from `public/`.
- **typescript** — used as a library (Compiler API), not just a dev tool.
- **zod** — MCP tool input validation.

### Quality Gates

```bash
npm run lint        # ESLint (strict typescript-eslint)
npm run typecheck   # tsc --noEmit
npm run build       # tsc
npm run test        # vitest
```

All four must pass before shipping. Run in order: lint -> typecheck -> build -> test.

### ESLint Rules
- Strict type-checked config (`strictTypeChecked`)
- No `any` — use `unknown` + type guards
- No unused vars (except `_` prefix)
- Consistent type imports enforced
- Explicit return types on non-expression functions
- MCP handlers exempt from `require-await` and `no-deprecated` (SDK constraints)

## Security Rules

### Client-side (public/index.html)
- **NEVER use innerHTML with dynamic data** — use DOM API (`createElement` + `textContent`)
- **NEVER use inline onclick attributes** — use `addEventListener`
- All node data from the API must be treated as untrusted (file paths can contain HTML metacharacters)
- Use the `el()` helper for safe DOM construction

### Server-side
- Validate and clamp all query parameters (especially `limit`)
- API routes should return JSON 404s, not HTML
- No filesystem access beyond the parsed graph data

## File Conventions

- New analysis metrics go in `src/analyzer/index.ts`
- New MCP tools go in `src/mcp/index.ts` (register with `server.tool()`)
- New REST endpoints go in `src/server/api.ts`
- New browser views go in `public/index.html` (add render function + view tab)
- Types always in `src/types/index.ts`

## Common Pitfalls

- graphology's `getNodeAttribute()` returns `unknown` — always cast with `as Type | undefined`
- `path.sep` differs on Windows vs Linux — normalize to forward slashes for cross-platform
- Parser's `walkDir` tracks visited dirs to prevent symlink loops
- Circular dep detection uses iterative DFS (not recursive) to avoid stack overflow
- MCP tool handlers must be async (SDK requirement) even if they don't await

## Testing

- Test runner: vitest
- Test files: `src/**/*.test.ts`
- Run: `npm test` or `npx vitest run`
- Focus on parser accuracy and analyzer metric correctness
