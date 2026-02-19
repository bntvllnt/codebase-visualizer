/** Validators — deep nesting, high complexity */
import type { User } from "../models/user.js";

export function validateEmail(email: string): { valid: boolean; reason?: string } {
  if (!email) return { valid: false, reason: "empty" };
  if (!email.includes("@")) return { valid: false, reason: "missing @" };
  if (email.startsWith("@")) return { valid: false, reason: "starts with @" };
  if (email.endsWith("@")) return { valid: false, reason: "ends with @" };
  const parts = email.split("@");
  if (parts.length !== 2) return { valid: false, reason: "multiple @" };
  if (!parts[1]?.includes(".")) return { valid: false, reason: "no domain TLD" };
  return { valid: true };
}

export function validateUser(user: Partial<User>): string[] {
  const errors: string[] = [];
  if (!user.name) errors.push("name required");
  if (!user.email) {
    errors.push("email required");
  } else {
    const result = validateEmail(user.email);
    if (!result.valid) errors.push(`email invalid: ${result.reason}`);
  }
  if (user.role && !["admin", "user", "guest"].includes(user.role)) {
    errors.push("invalid role");
  }
  return errors;
}

/** Unused */
export function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
}
