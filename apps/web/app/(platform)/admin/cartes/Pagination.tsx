import { cx } from "@app/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Pages à afficher : toujours la première et la dernière, la page courante et ses voisines ; les
 * trous deviennent « … » (un trou d'une seule page affiche la page plutôt que « … »).
 */
export function pageList(page: number, count: number): (number | "…")[] {
  const shown = new Set([1, count, page - 1, page, page + 1]);
  // Près d'un bout, on garde cinq numéros d'affilée pour que la barre ne change pas de largeur.
  if (page <= 3) [2, 3, 4, 5].forEach((p) => shown.add(p));
  if (page >= count - 2) [count - 1, count - 2, count - 3, count - 4].forEach((p) => shown.add(p));
  const pages = [...shown].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const list: (number | "…")[] = [];
  for (const p of pages) {
    const prev = list.at(-1);
    if (typeof prev === "number" && p - prev === 2) list.push(prev + 1);
    else if (typeof prev === "number" && p - prev > 2) list.push("…");
    list.push(p);
  }
  return list;
}

const cell =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm tabular-nums transition-colors";

/** Pagination « < 1 2 … 5 > » : flèches, première et dernière page toujours accessibles. */
export function Pagination({
  page,
  count,
  href,
}: {
  page: number;
  count: number;
  href: (page: number) => string;
}) {
  if (count <= 1) return null;
  const arrow = (to: number, label: string, icon: ReactNode) =>
    to < 1 || to > count ? (
      <span aria-hidden className={cx(cell, "text-muted opacity-35")}>
        {icon}
      </span>
    ) : (
      <Link
        href={href(to)}
        aria-label={label}
        className={cx(cell, "text-muted hover:bg-surface-hover hover:text-text")}
      >
        {icon}
      </Link>
    );
  return (
    <nav
      aria-label="Pages"
      className="border-border bg-surface inline-flex items-center gap-1 rounded-full border p-1 shadow-sm"
    >
      {arrow(page - 1, "Page précédente", <ChevronLeft size={18} aria-hidden />)}
      {pageList(page, count).map((p, i) =>
        p === "…" ? (
          <span key={`…${i}`} aria-hidden className={cx(cell, "text-muted min-w-6 px-0")}>
            …
          </span>
        ) : p === page ? (
          <span
            key={p}
            aria-current="page"
            className={cx(
              cell,
              "text-on-accent bg-(image:--accent-gradient) font-semibold shadow-[0_0_0_1px_rgb(0_0_0/0.3),0_4px_14px_-4px_var(--accent)]",
            )}
          >
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-label={`Page ${p}`}
            className={cx(cell, "text-muted hover:bg-surface-hover hover:text-text")}
          >
            {p}
          </Link>
        ),
      )}
      {arrow(page + 1, "Page suivante", <ChevronRight size={18} aria-hidden />)}
    </nav>
  );
}
