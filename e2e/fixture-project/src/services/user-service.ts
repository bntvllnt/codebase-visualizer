/** User service — high complexity, many branches */
import type { User, UserCreateInput, UserId } from "../models/user.js";
import { formatDate, slugify } from "../utils/format.js";
import { fetchData } from "./api-client.js";

const users: Map<string, User> = new Map();

export function createUser(input: UserCreateInput): User {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error("Name is required");
  }
  if (!input.email || !input.email.includes("@")) {
    throw new Error("Valid email is required");
  }

  const role = input.role ?? "user";
  const id = slugify(input.name) + "-" + Date.now();

  if (role === "admin") {
    const existing = Array.from(users.values()).filter((u) => u.role === "admin");
    if (existing.length >= 3) {
      throw new Error("Maximum 3 admins allowed");
    }
  }

  const user: User = {
    id,
    name: input.name.trim(),
    email: input.email.toLowerCase(),
    role,
    createdAt: new Date(),
  };

  users.set(id, user);
  return user;
}

export function deleteUser(id: UserId): boolean {
  return users.delete(id);
}

export function findUser(id: UserId): User | undefined {
  return users.get(id);
}

export function listUsers(role?: User["role"]): User[] {
  const all = Array.from(users.values());
  if (!role) return all;
  return all.filter((u) => u.role === role);
}

/** High cyclomatic complexity — many conditions */
export function processUser(user: User, action: string): string {
  const date = formatDate(user.createdAt);

  if (action === "activate") {
    if (user.role === "admin") return `Admin ${user.name} activated on ${date}`;
    if (user.role === "user") return `User ${user.name} activated on ${date}`;
    if (user.role === "guest") return `Guest ${user.name} activated on ${date}`;
    return `Unknown role for ${user.name}`;
  } else if (action === "deactivate") {
    if (user.role === "admin") return `Cannot deactivate admin ${user.name}`;
    return `${user.name} deactivated`;
  } else if (action === "promote") {
    if (user.role === "guest") return `${user.name} promoted to user`;
    if (user.role === "user") return `${user.name} promoted to admin`;
    return `${user.name} already admin`;
  } else if (action === "export") {
    void fetchData(`/users/${user.id}/export`);
    return `Exporting ${user.name}`;
  }
  return `Unknown action: ${action}`;
}

/** Dead export — unused */
export function getUserCount(): number {
  return users.size;
}
