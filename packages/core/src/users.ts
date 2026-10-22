import { db } from "@app/db";

export type Role = "member" | "admin";

export type User = {
  id: string;
  discordId: string | null;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  createdAt: Date;
};

const select = {
  id: true,
  discordId: true,
  name: true,
  email: true,
  image: true,
  role: true,
  createdAt: true,
} as const;

export async function getUser(id: string): Promise<User | null> {
  return db.user.findUnique({ where: { id }, select });
}

export async function getUsersByIds(ids: readonly string[]): Promise<User[]> {
  if (ids.length === 0) return [];
  return db.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select });
}

export async function listUsers(): Promise<User[]> {
  return db.user.findMany({ select, orderBy: { name: "asc" } });
}
