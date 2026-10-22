import { BRAND } from "@app/config/brand";
import type { ReactNode } from "react";
import { Avatar } from "@app/ui";

type Props = {
  user: { name: string; image: string | null };
  /** Bouton du menu mobile (la colonne compte passe dans un menu sur petit écran). */
  menuButton?: ReactNode;
  /** Cloche de notifications, etc. */
  actions?: ReactNode;
};

export function Header({ user, menuButton, actions }: Props) {
  return (
    <header className="bg-bg/80 sticky top-0 z-30 flex h-14 items-center gap-3 px-4 backdrop-blur-md">
      {/* liseré doré sous le header */}
      <span
        aria-hidden
        className="via-accent/60 absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent to-transparent"
      />
      {menuButton}
      <a href="/" className="flex items-center gap-2">
        <img src={BRAND.logo} alt="" className="size-11 shrink-0" />
        <span className="font-display text-gradient text-xl font-bold tracking-[0.12em]">
          {BRAND.name}
        </span>
      </a>
      <div className="ml-auto flex items-center gap-2">
        {actions}
        <Avatar name={user.name} src={user.image} />
      </div>
    </header>
  );
}
