import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { UserAvatar } from "./UserAvatar";

type Props = {
  user: { name: string; image: string | null; role: "member" | "admin" };
  /** Server action de déconnexion, passée par l'app. */
  signOut: () => Promise<void>;
  /** Solde, dernières transactions… fournis par les autres modules. */
  children?: ReactNode;
};

export function AccountPanel({ user, signOut, children }: Props) {
  return (
    <section className="border-border bg-surface flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <UserAvatar user={user} size={48} />
        <div className="min-w-0">
          <p className="text-text truncate font-medium">{user.name}</p>
          {user.role === "admin" && <p className="text-accent text-xs">Admin</p>}
        </div>
      </div>
      {children}
      <form action={signOut}>
        <button
          type="submit"
          className="border-border text-muted hover:text-text flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <LogOut size={16} aria-hidden />
          Se déconnecter
        </button>
      </form>
    </section>
  );
}
