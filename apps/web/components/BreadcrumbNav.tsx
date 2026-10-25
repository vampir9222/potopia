"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

/** Libellé d'un segment dynamique (identifiant), selon la section qui le précède. */
const ITEM_LABELS: Record<string, string> = {
  agents: "Mission",
  ideas: "Idée",
};

type Props = {
  /** Libellé de chaque segment d'URL (calculé côté serveur par `Breadcrumb`). */
  labels: Record<string, string>;
};

/** Fil d'Ariane avec un bouton retour vers le niveau parent : Accueil › Administration › Monnaie. */
export function BreadcrumbNav({ labels }: Props) {
  const segments = usePathname().split("/").filter(Boolean);
  const crumbs = [
    { href: "/", label: "Accueil" },
    ...segments.map((segment, i) => ({
      href: `/${segments.slice(0, i + 1).join("/")}`,
      label: labels[segment] ?? ITEM_LABELS[segments[i - 1] ?? ""] ?? segment,
    })),
  ];
  const parent = crumbs.at(-2);

  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm">
      {parent && (
        <Link
          href={parent.href}
          aria-label={`Retour : ${parent.label}`}
          className="border-border text-muted hover:text-text hover:bg-surface-hover rounded-md border p-1.5"
        >
          <ArrowLeft size={16} />
        </Link>
      )}
      <ol className="flex flex-wrap items-center gap-1">
        {crumbs.map((crumb, i) => (
          <Fragment key={crumb.href}>
            {i > 0 && <ChevronRight size={14} className="text-muted" aria-hidden />}
            <li>
              {i === crumbs.length - 1 ? (
                <span aria-current="page" className="text-text font-medium">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="text-muted hover:text-text">
                  {crumb.label}
                </Link>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
