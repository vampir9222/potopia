import { formatRelative } from "./format";
import { UserAvatar } from "./UserAvatar";

export type ActivityItem = {
  id: string;
  user: { name: string; image: string | null } | null;
  /** Phrase déjà rédigée par l'app (« a proposé une idée »), sans contenu privé. */
  text: string;
  createdAt: Date;
};

type Props = {
  items: ActivityItem[];
};

export function ActivityFeed({ items }: Props) {
  if (items.length === 0) {
    return <p className="text-muted py-6 text-center text-sm">Rien de neuf pour l'instant.</p>;
  }
  return (
    <ul className="divide-border divide-y">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 py-3">
          <UserAvatar user={item.user ?? { name: "?", image: null }} size={28} />
          <p className="text-text min-w-0 flex-1 text-sm">
            <span className="font-medium">{item.user?.name ?? "Quelqu'un"}</span> {item.text}
          </p>
          <time dateTime={item.createdAt.toISOString()} className="text-muted shrink-0 text-xs">
            {formatRelative(item.createdAt)}
          </time>
        </li>
      ))}
    </ul>
  );
}
