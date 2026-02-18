# MCP Tools Reference

7 tools available via `--mcp` mode (stdio transport).

## 1. codebase_overview

High-level summary of the entire codebase.

**Input:** `{ depth?: number }`
**Returns:** totalFiles, totalFunctions, totalDependencies, modules (sorted by size), topDependedFiles (top 5 by fanIn), globalMetrics (avgLOC, maxDepth, circularDepCount)

**Use case:** First tool to call. Get the lay of the land before drilling into specifics.

## 2. file_context

Detailed context for a single file.

**Input:** `{ filePath: string }` (relative path)
**Returns:** path, loc, exports, imports (with symbols), dependents (with symbols), metrics (all FileMetrics including churn, complexity, blastRadius, deadExports, hasTests, testFile)

**Use case:** Before modifying a file, understand its role, connections, and risk profile.

## 3. get_dependents

Blast radius analysis — what breaks if this file changes.

**Input:** `{ filePath: string, depth?: number }` (default depth: 2)
**Returns:** directDependents (with symbols), transitiveDependents (with path through), totalAffected, riskLevel (LOW/MEDIUM/HIGH)

**Use case:** Before refactoring an export, check who consumes it and how deep the impact goes.

## 4. find_hotspots

Rank files by any metric. The swiss-army knife for codebase analysis.

**Input:** `{ metric: string, limit?: number }` (default limit: 10)
**Metrics:** coupling, pagerank, fan_in, fan_out, betweenness, tension, escape_velocity, churn, complexity, blast_radius, coverage
**Returns:** ranked files with score + reason, summary

**Use case:** "What are the most complex files?" → `metric: "complexity"`. "What files change most?" → `metric: "churn"`. "What files have no tests?" → `metric: "coverage"`.

## 5. get_module_structure

Module-level architecture with cross-module dependencies.

**Input:** `{ depth?: number }`
**Returns:** modules (with all ModuleMetrics), crossModuleDeps (from->to with weight), circularDeps (with severity)

**Use case:** Understand module boundaries, find tightly coupled modules, identify circular module dependencies.

## 6. analyze_forces

Architectural force analysis — tension, bridges, junk drawers, extraction candidates.

**Input:** `{ cohesionThreshold?: number, tensionThreshold?: number, escapeThreshold?: number }`
**Returns:** moduleCohesion (with verdicts), tensionFiles (with pull details + recommendations), bridgeFiles (with connections), extractionCandidates (with recommendations), summary

**Use case:** Identify architectural problems. Tension files need splitting. Junk drawers need restructuring. Extraction candidates should become packages.

## 7. find_dead_exports

Find unused exports across the codebase.

**Input:** `{ module?: string, limit?: number }` (default limit: 20)
**Returns:** totalDeadExports, files (with path, module, deadExports[], totalExports), summary

**Use case:** Clean up dead code. Unused exports increase API surface without value. Safe to remove.

## Tool Selection Guide

| Question | Tool |
|----------|------|
| "What does this codebase look like?" | `codebase_overview` |
| "Tell me about file X" | `file_context` |
| "What breaks if I change X?" | `get_dependents` |
| "What are the riskiest files?" | `find_hotspots` (coupling, churn, or blast_radius) |
| "Which files need tests?" | `find_hotspots` (coverage) |
| "What can I safely delete?" | `find_dead_exports` |
| "How are modules organized?" | `get_module_structure` |
| "What's architecturally wrong?" | `analyze_forces` |
