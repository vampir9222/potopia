"use client";

import { LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@app/ui";

type Props = {
  user: { name: string; image: string | null };
  /** Server action de déconnexion, passée par l'app. */
  signOut: () => Promise<void>;
};

/** Avatar du header : un clic ouvre un petit menu avec la déconnexion. */
export function ProfileMenu({ user, signOut }: Props) {
  const [open, setOpen] = useState(false);
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
        aria-label="Menu du profil"
        aria-expanded={open}
        className="hover:ring-accent/60 block rounded-full ring-2 ring-transparent transition-shadow"
      >
        <Avatar name={user.name} src={user.image} />
      </button>

      {open && (
        <div className="theme-frame rounded-theme animate-rise absolute right-0 mt-2 w-56 overflow-hidden shadow-2xl">
          <p className="border-border text-text truncate border-b px-4 py-2 text-sm font-medium">
            {user.name}
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="text-muted hover:bg-surface-hover hover:text-text flex w-full items-center gap-2 px-4 py-2.5 text-sm"
            >
              <LogOut size={16} aria-hidden />
              Se déconnecter
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
