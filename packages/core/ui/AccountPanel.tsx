import type { ReactNode } from "react";
import { Avatar } from "@app/ui";

type Props = {
  user: { name: string; image: string | null; role: "member" | "admin" };
  /** Personnage animé du membre (et son bouton vers l'éditeur), fourni par l'app. */
  figure?: ReactNode;
  /** Solde, dernières transactions… fournis par les autres modules. */
  children?: ReactNode;
};

export function AccountPanel({ user, figure, children }: Props) {
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
      {figure}
      {children}
    </section>
  );
}
