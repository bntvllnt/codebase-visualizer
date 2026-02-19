/** User model — type-only file (no runtime exports) */
export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
  createdAt: Date;
}

export interface UserCreateInput {
  name: string;
  email: string;
  role?: User["role"];
}

export type UserId = string;
