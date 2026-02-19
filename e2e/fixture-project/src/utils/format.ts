/** Format utilities — used by multiple services */
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0] ?? "";
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

/** Dead export */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
