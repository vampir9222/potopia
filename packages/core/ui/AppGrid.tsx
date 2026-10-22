import { Grid3x3, Lightbulb, Shield, type LucideIcon } from "lucide-react";
import type { AppEntry, AppIconName } from "../src/apps/registry";

// Import explicite de chaque icône : importer tout lucide alourdirait le bundle client.
const ICONS: Record<AppIconName, LucideIcon> = {
  grid: Grid3x3,
  lightbulb: Lightbulb,
  shield: Shield,
};

type Props = {
  apps: Pick<AppEntry, "id" | "name" | "icon" | "route">[];
};

export function AppGrid({ apps }: Props) {
  if (apps.length === 0) return null;
  return (
    <ul className="stagger grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
      {apps.map((app) => {
        const Icon = ICONS[app.icon];
        return (
          <li key={app.id}>
            <a
              href={app.route}
              className="group shine rounded-theme bg-surface/80 hover:border-accent/70 flex aspect-square [transform:perspective(600px)] flex-col items-center justify-center gap-2 border border-(--frame) p-3 text-center text-sm transition-all duration-300 hover:[transform:perspective(600px)_rotateX(8deg)_translateY(-4px)] hover:shadow-[0_14px_30px_-12px_var(--accent)]"
            >
              <span className="bg-arcane/15 ring-accent/30 group-hover:ring-accent/70 grid size-12 place-items-center rounded-full ring-1 transition-shadow group-hover:shadow-[0_0_18px_var(--accent)]">
                <Icon
                  size={26}
                  className="text-accent group-hover:animate-float transition-transform duration-300 group-hover:scale-110"
                  aria-hidden
                />
              </span>
              <span className="font-display text-text line-clamp-2 text-xs font-semibold tracking-wide sm:text-sm">
                {app.name}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
