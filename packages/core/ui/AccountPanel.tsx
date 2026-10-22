import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, Button } from "@app/ui";

type Props = {
  user: { name: string; image: string | null; role: "member" | "admin" };
  /** Server action de déconnexion, passée par l'app. */
  signOut: () => Promise<void>;
  /** Solde, dernières transactions… fournis par les autres modules. */
  children?: ReactNode;
};

export function AccountPanel({ user, signOut, children }: Props) {
  return (
    <section className="theme-frame rounded-theme flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Avatar name={user.name} src={user.image} size={48} />
        <div className="min-w-0">
          <p className="font-display text-text truncate font-semibold tracking-wide">{user.name}</p>
          <p className="text-muted text-xs">
            {user.role === "admin" ? <span className="text-accent">♛ Admin</span> : "Membre"}
          </p>
        </div>
      </div>
      {children}
      <form action={signOut}>
        <Button type="submit" variant="secondary" className="w-full">
          <LogOut size={16} aria-hidden />
          Se déconnecter
        </Button>
      </form>
    </section>
  );
}
