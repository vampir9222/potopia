"use client";

import { Bell } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatRelative } from "./format";

export type NotificationItem = {
  id: string;
  title: string;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
};

type Props = {
  notifications: NotificationItem[];
  unreadCount: number;
  /** Server actions passées par l'app (elles vérifient la session). */
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

export function NotificationBell({ notifications, unreadCount, markAsRead, markAllAsRead }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} non lues)` : "Notifications"}
        aria-expanded={open}
        className="text-muted hover:bg-surface hover:text-text relative rounded-md p-2"
      >
        {/* la cloche s'agite de temps en temps tant qu'il reste du non-lu */}
        <Bell size={20} className={unreadCount > 0 ? "animate-wiggle text-accent" : undefined} />
        {unreadCount > 0 && (
          <span className="animate-glow bg-accent text-on-accent absolute top-1 right-1 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="theme-frame rounded-theme animate-rise absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden shadow-2xl">
          <div className="border-border flex items-center justify-between border-b px-4 py-2">
            <span className="text-text text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(markAllAsRead)}
                className="text-accent text-xs hover:underline disabled:opacity-50"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-muted px-4 py-6 text-center text-sm">Aucune notification.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id} className="border-border border-b last:border-b-0">
                  <a
                    href={n.link ?? undefined}
                    onClick={() => {
                      if (!n.readAt) startTransition(() => markAsRead(n.id));
                    }}
                    className="hover:bg-surface-hover flex gap-3 px-4 py-3"
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "" : "bg-accent"}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${n.readAt ? "text-muted" : "text-text"}`}>
                        {n.title}
                      </span>
                      <span className="text-muted text-xs">{formatRelative(n.createdAt)}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
