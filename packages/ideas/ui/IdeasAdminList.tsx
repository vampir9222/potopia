import { BRAND } from "@app/config/brand";
import { Badge, Button, buttonClasses, EmptyState, Select } from "@app/ui";
import { ImageIcon } from "lucide-react";
import { RARITIES, RARITY_LABELS, type Rarity } from "../src/validation";

export type IdeaListItem = {
  id: string;
  title: string;
  authorName: string;
  rarity: Rarity | null;
  hasImage: boolean;
  createdAt: Date;
};

type Props = {
  items: IdeaListItem[];
  authors: { id: string; name: string }[];
  filters: { authorId?: string; rarity?: Rarity };
  nextCursor: string | null;
  /** Page de la liste (`/admin/ideas`) ; le détail est `${basePath}/${id}`. */
  basePath: string;
};

const date = new Intl.DateTimeFormat(BRAND.locale, { dateStyle: "short", timeStyle: "short" });

export function IdeasAdminList({ items, authors, filters, nextCursor, basePath }: Props) {
  const query = new URLSearchParams();
  if (filters.authorId) query.set("author", filters.authorId);
  if (filters.rarity) query.set("rarity", filters.rarity);

  return (
    <div className="flex flex-col gap-4">
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-2">
        <Select name="author" defaultValue={filters.authorId ?? ""} className="w-auto">
          <option value="">Tous les auteurs</option>
          {authors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select name="rarity" defaultValue={filters.rarity ?? ""} className="w-auto">
          <option value="">Toutes les raretés</option>
          {RARITIES.map((r) => (
            <option key={r} value={r}>
              {RARITY_LABELS[r]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filtrer
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState title="Aucune idée" description="Rien ne correspond à ces filtres." />
      ) : (
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
      )}

      {nextCursor && (
        <a
          href={`${basePath}?${new URLSearchParams([...query, ["cursor", nextCursor]])}`}
          className={buttonClasses({ variant: "secondary", size: "sm", className: "self-start" })}
        >
          Plus anciennes
        </a>
      )}
    </div>
  );
}
