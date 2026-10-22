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
    <section className="border-border bg-surface rounded-theme flex flex-col gap-4 border p-4">
      <div className="flex items-center gap-3">
        <Avatar name={user.name} src={user.image} size={48} />
        <div className="min-w-0">
          <p className="text-text truncate font-medium">{user.name}</p>
          {user.role === "admin" && <p className="text-accent text-xs">Admin</p>}
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
