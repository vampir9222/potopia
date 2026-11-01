import type { Role } from "../users";

/** Icônes lucide disponibles pour les tuiles (la correspondance est dans ui/AppGrid). */
export type AppIconName = "grid" | "lightbulb" | "mask" | "palette" | "shield" | "trophy";

export type AppEntry = {
  id: string;
  name: string;
  icon: AppIconName;
  route: string;
  requiredRole: Role;
};

/** Apps de la plateforme, dans l'ordre d'affichage des tuiles. */
export const apps: readonly AppEntry[] = [
  { id: "goty", name: "GOTY Party", icon: "trophy", route: "/goty", requiredRole: "member" },
  { id: "trois", name: "TROIS", icon: "grid", route: "/trois", requiredRole: "member" },
  {
    id: "agents",
    name: "Agents Doubles",
    icon: "mask",
    route: "/agents",
    requiredRole: "member",
  },
  {
    id: "ideas",
    name: "Boîte à idées",
    icon: "lightbulb",
    route: "/ideas",
    requiredRole: "member",
  },
  {
    id: "cards",
    name: "Vote design des cartes",
    icon: "palette",
    route: "/cartes",
    requiredRole: "member",
  },
  { id: "admin", name: "Administration", icon: "shield", route: "/admin", requiredRole: "admin" },
];

export function getVisibleApps(user: { role: Role }): AppEntry[] {
  return apps.filter((app) => app.requiredRole === "member" || user.role === "admin");
}
