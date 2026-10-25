"use client";

import { BRAND } from "@app/config/brand";
import { Badge, Button, EmptyState } from "@app/ui";
import { ArrowUp, ImageIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { RARITY_LABELS, type Rarity } from "../src/validation";

export type IdeaListItem = {
  id: string;
  title: string;
  authorName: string;
  rarity: Rarity | null;
  hasImage: boolean;
  createdAt: Date;
};

export type IdeaPage = { items: IdeaListItem[]; nextCursor: string | null };

type Props = {
  initial: IdeaPage;
  /** Page de la liste (`/admin/ideas`) ; le détail est `${basePath}/${id}`. */
  basePath: string;
  /**
   * Server action passée par l'app (requireAdmin puis listIdeas) : la page suivante après `cursor`,
   * avec les mêmes filtres que la première.
   */
  loadMore: (cursor: string) => Promise<IdeaPage>;
};

const date = new Intl.DateTimeFormat(BRAND.locale, {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: BRAND.timeZone,
});

/**
 * Liste des idées qui se charge au défilement : arrivé en bas, la page suivante s'ajoute à la
 * suite. Un bouton permet de remonter en haut d'un coup.
 */
export function IdeasFeed({ initial, basePath, loadMore }: Props) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  // Nouveaux filtres (nouvelle première page) : on repart de zéro.
  const [shownInitial, setShownInitial] = useState(initial);
  if (initial !== shownInitial) {
    setShownInitial(initial);
    setItems(initial.items);
    setCursor(initial.nextCursor);
    setError(false);
  }

  const next = useCallback(async () => {
    if (!cursor || busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(false);
    try {
      const page = await loadMore(cursor);
      setItems((list) => [...list, ...page.items.filter((i) => !list.some((l) => l.id === i.id))]);
      setCursor(page.nextCursor);
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [cursor, loadMore]);

  // Le repère en bas de liste devient visible : page suivante.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void next();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, error, next]);

  // Bouton « Remonter » une fois qu'on a un peu défilé.
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (items.length === 0) {
    return <EmptyState title="Aucune idée" description="Rien ne correspond à ces filtres." />;
  }

  return (
    <>
      <ul className="divide-border divide-y">
        {items.map((idea) => (
          <li key={idea.id}>
            <a
              href={`${basePath}/${idea.id}`}
              className="hover:bg-surface-hover -mx-2 flex items-center gap-3 rounded-md px-2 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-text truncate text-sm font-medium">{idea.title}</p>
                <p className="text-muted text-xs">
                  {idea.authorName} · {date.format(idea.createdAt)}
                </p>
              </div>
              {idea.hasImage && <ImageIcon size={16} className="text-muted" aria-label="Image" />}
              {idea.rarity && <Badge tone="accent">{RARITY_LABELS[idea.rarity]}</Badge>}
            </a>
          </li>
        ))}
      </ul>

      <div ref={sentinel} aria-live="polite" className="text-muted py-2 text-center text-sm">
        {loading ? (
          "Chargement…"
        ) : error ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => void next()}>
            Réessayer
          </Button>
        ) : cursor ? (
          // Repli sans défilement automatique (clavier, lecteur d'écran).
          <Button type="button" variant="ghost" size="sm" onClick={() => void next()}>
            Charger les suivantes
          </Button>
        ) : (
          `${items.length} idée${items.length > 1 ? "s" : ""}, c'est tout.`
        )}
      </div>

      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Remonter en haut de la liste"
          title="Remonter"
          className="bg-accent text-bg hover:bg-accent-hover fixed right-6 bottom-6 z-40 flex size-12 items-center justify-center rounded-full shadow-xl transition-colors"
        >
          <ArrowUp size={22} aria-hidden />
        </button>
      )}
    </>
  );
}
