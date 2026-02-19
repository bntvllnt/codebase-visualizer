const SOURCE_DIRS = new Set(["src", "lib", "app", "packages", "apps"]);

export function cloudGroup(mod: string): string {
  const parts = mod.replace(/\/$/, "").split("/").filter(Boolean);
  if (parts.length === 0 || parts[0] === ".") return "root";
  if (SOURCE_DIRS.has(parts[0]) && parts.length > 1) return parts[1];
  return parts[0];
}
