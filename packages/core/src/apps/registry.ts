import type { Role } from "../users";

/** Icônes lucide disponibles pour les tuiles (la correspondance est dans ui/AppGrid). */
export type AppIconName = "shield";

export type AppEntry = {
  id: string;
  name: string;
  icon: AppIconName;
  route: string;
  requiredRole: Role;
};

/** Apps de la plateforme, dans l'ordre d'affichage des tuiles. */
export const apps: readonly AppEntry[] = [
  { id: "admin", name: "Administration", icon: "shield", route: "/admin", requiredRole: "admin" },
];

export function getVisibleApps(user: { role: Role }): AppEntry[] {
  return apps.filter((app) => app.requiredRole === "member" || user.role === "admin");
}
