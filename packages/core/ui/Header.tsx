import { BRAND } from "@app/config/brand";
import type { ReactNode } from "react";
import { UserAvatar } from "./UserAvatar";

type Props = {
  user: { name: string; image: string | null };
  /** Bouton du menu mobile (la colonne compte passe dans un menu sur petit écran). */
  menuButton?: ReactNode;
  /** Cloche de notifications, etc. */
  actions?: ReactNode;
};

export function Header({ user, menuButton, actions }: Props) {
  return (
    <header className="border-border bg-bg/90 sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur">
      {menuButton}
      <a href="/" className="text-text text-lg font-semibold">
        {BRAND.name}
      </a>
      <div className="ml-auto flex items-center gap-2">
        {actions}
        <UserAvatar user={user} />
      </div>
    </header>
  );
}
