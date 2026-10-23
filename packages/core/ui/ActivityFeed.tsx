import { formatRelative } from "./format";
import { Avatar } from "@app/ui";
import { VisibleRows } from "./VisibleRows";

const VISIBLE_ROWS = 10;

export type ActivityItem = {
  id: string;
  user: { name: string; image: string | null } | null;
  /** Phrase déjà rédigée par l'app (« a proposé une idée »), sans contenu privé. */
  text: string;
  /** Mise en avant dorée (exploit : 3 sur 3, record…). */
  highlight?: boolean;
  createdAt: Date;
};

type Props = {
  items: ActivityItem[];
  /** Remplit la hauteur du parent (flex) et défile, au lieu de montrer 10 lignes. */
  fill?: boolean;
};

export function ActivityFeed({ items, fill = false }: Props) {
  if (items.length === 0) {
    return <p className="text-muted py-6 text-center text-sm">Rien de neuf pour l'instant.</p>;
  }
  // Le padding horizontal compense le `-mx-2` des lignes mises en avant, sinon rogné par le
  // conteneur défilant.
  const listClass = "stagger divide-border -mx-2 divide-y px-2";
  const rows = items.map((item) => (
    <li
      key={item.id}
      className={`flex items-center gap-3 py-3 ${item.highlight ? "bg-accent/8 -mx-2 rounded-md px-2 shadow-[inset_2px_0_0_var(--accent)]" : ""}`}
    >
      <Avatar name={item.user?.name ?? "?"} src={item.user?.image} size={28} />
      <p className="text-text min-w-0 flex-1 text-sm">
        <span className="font-medium">{item.user?.name ?? "Quelqu'un"}</span>{" "}
        <span className={item.highlight ? "text-gradient font-semibold" : undefined}>
          {item.text}
        </span>
      </p>
      <time dateTime={item.createdAt.toISOString()} className="text-muted shrink-0 text-xs">
        {formatRelative(item.createdAt)}
      </time>
    </li>
  ));
  return fill ? (
    <ul className={`${listClass} min-h-0 flex-1 overflow-y-auto`}>{rows}</ul>
  ) : (
    // 10 lignes visibles, le reste défile.
    <VisibleRows rows={VISIBLE_ROWS} className={listClass}>
      {rows}
    </VisibleRows>
  );
}
