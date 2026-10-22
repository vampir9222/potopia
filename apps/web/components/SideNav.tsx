"use client";

import { cx } from "@app/ui";
import { Coins, House, Shield, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean };

const ITEMS: Item[] = [
  { href: "/", label: "Accueil", icon: House },
  { href: "/wallet", label: "Ma monnaie", icon: Coins },
  { href: "/admin", label: "Administration", icon: Shield, adminOnly: true },
];

/** Menu de la colonne de gauche (et du menu mobile). La page courante est mise en avant. */
export function SideNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Menu principal">
      <ul className="flex flex-col gap-0.5">
        {ITEMS.filter((item) => !item.adminOnly || isAdmin).map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cx(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                isActive(href)
                  ? "bg-surface-hover text-text font-medium"
                  : "text-muted hover:bg-surface-hover hover:text-text",
              )}
            >
              <Icon size={16} aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
