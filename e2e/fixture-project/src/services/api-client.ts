/** API client — creates circular dependency with auth */
import { getToken } from "./auth.js";

export async function fetchData(url: string): Promise<unknown> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return { url, headers, mock: true };
}

export async function postData(url: string, body: unknown): Promise<unknown> {
  const token = getToken();
  return { url, body, token, mock: true };
}

/** Dead export */
export function buildUrl(base: string, path: string): string {
  return `${base}/${path}`;
}
