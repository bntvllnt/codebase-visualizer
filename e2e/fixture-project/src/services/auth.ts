/** Auth service — circular dep with api-client */
import { postData } from "./api-client.js";

let currentToken: string | null = null;

export function getToken(): string | null {
  return currentToken;
}

export async function login(email: string, password: string): Promise<boolean> {
  const result = await postData("/auth/login", { email, password });
  if (result) {
    currentToken = "mock-token-" + Date.now();
    return true;
  }
  return false;
}

export function logout(): void {
  currentToken = null;
}
