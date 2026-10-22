import { Shield, type LucideIcon } from "lucide-react";
import type { AppEntry, AppIconName } from "../src/apps/registry";

// Import explicite de chaque icône : importer tout lucide alourdirait le bundle client.
const ICONS: Record<AppIconName, LucideIcon> = {
  shield: Shield,
};

type Props = {
  apps: Pick<AppEntry, "id" | "name" | "icon" | "route">[];
};

export function AppGrid({ apps }: Props) {
  if (apps.length === 0) return null;
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {apps.map((app) => {
        const Icon = ICONS[app.icon];
        return (
          <li key={app.id}>
            <a
              href={app.route}
              className="border-border bg-surface text-text hover:border-accent rounded-theme flex aspect-square flex-col items-center justify-center gap-2 border p-3 text-center text-sm transition-colors"
            >
              <Icon size={28} className="text-accent" aria-hidden />
              <span className="line-clamp-2">{app.name}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
