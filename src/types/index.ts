export interface ParsedFile {
  path: string;
  relativePath: string;
  loc: number;
  exports: ParsedExport[];
  imports: ParsedImport[];
  churn: number;
  isTestFile: boolean;
  testFile?: string;
}

export interface ParsedExport {
  name: string;
  type: "function" | "class" | "variable" | "type" | "interface" | "enum";
  loc: number;
  isDefault: boolean;
  complexity: number;
}

export interface ParsedImport {
  from: string;
  resolvedFrom: string;
  symbols: string[];
  isTypeOnly: boolean;
}

export interface GraphNode {
  id: string;
  type: "file" | "function";
  path: string;
  label: string;
  loc: number;
  module: string;
  parentFile?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  symbols: string[];
  isTypeOnly: boolean;
  weight: number;
}

export interface FileMetrics {
  pageRank: number;
  betweenness: number;
  fanIn: number;
  fanOut: number;
  coupling: number;
  tension: number;
  isBridge: boolean;
  churn: number;
  cyclomaticComplexity: number;
  blastRadius: number;
  deadExports: string[];
  hasTests: boolean;
  testFile: string;
}

export interface ModuleMetrics {
  path: string;
  files: number;
  loc: number;
  exports: number;
  internalDeps: number;
  externalDeps: number;
  cohesion: number;
  escapeVelocity: number;
  dependsOn: string[];
  dependedBy: string[];
}

export interface TensionFile {
  file: string;
  tension: number;
  pulledBy: Array<{
    module: string;
    strength: number;
    symbols: string[];
  }>;
  recommendation: string;
}

export interface BridgeFile {
  file: string;
  betweenness: number;
  connects: string[];
  role: string;
}

export interface ExtractionCandidate {
  target: string;
  escapeVelocity: number;
  internalDeps: number;
  externalDeps: number;
  dependedByModules: number;
  recommendation: string;
}

export interface ForceAnalysis {
  moduleCohesion: Array<ModuleMetrics & { verdict: "COHESIVE" | "MODERATE" | "JUNK_DRAWER" }>;
  tensionFiles: TensionFile[];
  bridgeFiles: BridgeFile[];
  extractionCandidates: ExtractionCandidate[];
  summary: string;
}

export interface CodebaseGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  fileMetrics: Map<string, FileMetrics>;
  moduleMetrics: Map<string, ModuleMetrics>;
  forceAnalysis: ForceAnalysis;
  stats: {
    totalFiles: number;
    totalFunctions: number;
    totalDependencies: number;
    circularDeps: string[][];
  };
}
