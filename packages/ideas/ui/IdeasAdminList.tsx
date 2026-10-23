import { Button, Select } from "@app/ui";
import { RARITIES, RARITY_LABELS, type Rarity } from "../src/validation";
import { type IdeaPage, IdeasFeed } from "./IdeasFeed";

type Props = {
  /** Première page ; les suivantes arrivent au défilement via `loadMore`. */
  initial: IdeaPage;
  authors: { id: string; name: string }[];
  filters: { authorId?: string; rarity?: Rarity };
  /** Page de la liste (`/admin/ideas`) ; le détail est `${basePath}/${id}`. */
  basePath: string;
  /** Server action passée par l'app : page suivante après un curseur, mêmes filtres. */
  loadMore: (cursor: string) => Promise<IdeaPage>;
};

export function IdeasAdminList({ initial, authors, filters, basePath, loadMore }: Props) {
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

      <IdeasFeed initial={initial} basePath={basePath} loadMore={loadMore} />
    </div>
  );
}
