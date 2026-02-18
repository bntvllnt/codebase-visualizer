import ts from "typescript";
import path from "path";
import fs from "fs";
import type { ParsedFile, ParsedExport, ParsedImport } from "../types/index.js";

export function parseCodebase(rootDir: string): ParsedFile[] {
  const absoluteRoot = path.resolve(rootDir);

  if (!fs.existsSync(absoluteRoot)) {
    throw new Error(`Directory not found: ${rootDir}`);
  }

  const tsFiles = findTypeScriptFiles(absoluteRoot);

  if (tsFiles.length === 0) {
    throw new Error(`No TypeScript files found in ${rootDir}`);
  }

  const program = ts.createProgram(tsFiles, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.Node16,
    moduleResolution: ts.ModuleResolutionKind.Node16,
    allowJs: false,
    noEmit: true,
  });

  const checker = program.getTypeChecker();
  const parsed: ParsedFile[] = [];

  for (const filePath of tsFiles) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) continue;

    try {
      const result = parseFile(sourceFile, checker, absoluteRoot);
      parsed.push(result);
    } catch {
      console.warn(`Skipped ${path.relative(absoluteRoot, filePath)}: parse error`);
    }
  }

  return resolveImportPaths(parsed, absoluteRoot);
}

function findTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  const visited = new Set<string>();
  walkDir(dir, files, visited);
  return files.filter((f) => !f.endsWith(".d.ts") && !f.includes("node_modules"));
}

function walkDir(dir: string, results: string[], visited: Set<string>): void {
  const realDir = fs.realpathSync(dir);
  if (visited.has(realDir)) return;
  visited.add(realDir);

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isSymbolicLink()) {
      try {
        const realTarget = fs.realpathSync(fullPath);
        const stat = fs.statSync(realTarget);
        if (stat.isDirectory()) {
          if (!visited.has(realTarget)) walkDir(fullPath, results, visited);
        } else if (stat.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
          results.push(fullPath);
        }
      } catch {
        continue;
      }
    } else if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
        continue;
      }
      walkDir(fullPath, results, visited);
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      results.push(fullPath);
    }
  }
}

function parseFile(sourceFile: ts.SourceFile, checker: ts.TypeChecker, rootDir: string): ParsedFile {
  const filePath = sourceFile.fileName;
  const relativePath = path.relative(rootDir, filePath);
  const loc = sourceFile.getLineAndCharacterOfPosition(sourceFile.getEnd()).line + 1;
  const exports = extractExports(sourceFile, checker);
  const imports = extractImports(sourceFile);

  return { path: filePath, relativePath, loc, exports, imports };
}

function extractExports(sourceFile: ts.SourceFile, checker: ts.TypeChecker): ParsedExport[] {
  const exports: ParsedExport[] = [];
  const symbol = checker.getSymbolAtLocation(sourceFile);

  if (!symbol?.exports) return exports;

  symbol.exports.forEach((exportSymbol, name) => {
    const exportName = name.toString();
    if (exportName === "__export") return;

    const declarations = exportSymbol.getDeclarations();
    if (!declarations || declarations.length === 0) return;

    const decl = declarations[0];
    const exportType = getExportType(decl);
    const startLine = sourceFile.getLineAndCharacterOfPosition(decl.getStart()).line;
    const endLine = sourceFile.getLineAndCharacterOfPosition(decl.getEnd()).line;

    exports.push({
      name: exportName,
      type: exportType,
      loc: endLine - startLine + 1,
      isDefault: exportName === "default",
    });
  });

  return exports;
}

function getExportType(node: ts.Declaration): ParsedExport["type"] {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) {
    return "function";
  }
  if (ts.isClassDeclaration(node)) return "class";
  if (ts.isInterfaceDeclaration(node)) return "interface";
  if (ts.isTypeAliasDeclaration(node)) return "type";
  if (ts.isEnumDeclaration(node)) return "enum";
  if (ts.isVariableDeclaration(node)) {
    const init = node.initializer;
    if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
      return "function";
    }
  }
  return "variable";
}

function extractImports(sourceFile: ts.SourceFile): ParsedImport[] {
  const imports: ParsedImport[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isImportDeclaration(node)) return;
    if (!ts.isStringLiteral(node.moduleSpecifier)) return;

    const from = node.moduleSpecifier.text;

    // Skip external packages
    if (!from.startsWith(".") && !from.startsWith("/")) return;

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const isTypeOnly = node.importClause?.isTypeOnly ?? false;
    const symbols: string[] = [];

    if (node.importClause) {
      if (node.importClause.name) {
        symbols.push("default");
      }
      const bindings = node.importClause.namedBindings;
      if (bindings) {
        if (ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) {
            symbols.push(element.name.text);
          }
        } else if (ts.isNamespaceImport(bindings)) {
          symbols.push(`* as ${bindings.name.text}`);
        }
      }
    }

    imports.push({ from, resolvedFrom: "", symbols, isTypeOnly });
  });

  return imports;
}

function resolveImportPaths(files: ParsedFile[], rootDir: string): ParsedFile[] {
  const filePathSet = new Set(files.map((f) => f.path));

  for (const file of files) {
    for (const imp of file.imports) {
      const dir = path.dirname(file.path);
      const resolved = resolveModulePath(dir, imp.from, filePathSet);
      imp.resolvedFrom = resolved ? path.relative(rootDir, resolved) : imp.from;
    }
  }

  return files;
}

function resolveModulePath(fromDir: string, importPath: string, knownFiles: Set<string>): string | null {
  const base = path.resolve(fromDir, importPath);

  // Handle .js → .ts mapping (TypeScript uses .js in imports for ESM)
  const strippedBase = base.endsWith(".js") ? base.slice(0, -3) : base;

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    `${strippedBase}.ts`,
    `${strippedBase}.tsx`,
    path.join(strippedBase, "index.ts"),
    path.join(strippedBase, "index.tsx"),
  ];

  for (const candidate of candidates) {
    if (knownFiles.has(candidate)) return candidate;
  }

  return null;
}
