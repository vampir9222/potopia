import { BRAND } from "@app/config/brand";
import { AppLink } from "@app/ui";
import type { ReactNode } from "react";
import { ProfileMenu } from "./ProfileMenu";

type Props = {
  user: { name: string; image: string | null };
  /** Server action de déconnexion, proposée dans le menu de l'avatar. */
  signOut: () => Promise<void>;
  /** Bouton du menu mobile (la colonne compte passe dans un menu sur petit écran). */
  menuButton?: ReactNode;
  /** Cloche de notifications, etc. */
  actions?: ReactNode;
};

export function Header({ user, signOut, menuButton, actions }: Props) {
  return (
    <header className="bg-bg/80 sticky top-0 z-30 flex h-14 items-center gap-3 px-4 backdrop-blur-md">
      {/* liseré doré sous le header ; un bouton peut y creuser une trouée (--line-gap-from/to, en px
          depuis le bord gauche) pour le redessiner lui-même, déformé (Luffy qui rebondit dessus) */}
      <span
        aria-hidden
        className="via-accent/60 absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent to-transparent"
        style={{
          maskImage:
            "linear-gradient(to right, #000 var(--line-gap-from, 100%), transparent 0 var(--line-gap-to, 100%), #000 0)",
        }}
      />
      {menuButton}
      <AppLink href="/" aria-label={BRAND.name} className="flex min-w-0 items-center gap-2">
        <img src={BRAND.logo} alt="" className="size-11 shrink-0" />
        <span className="font-display text-gradient hidden text-xl font-bold tracking-[0.12em] min-[440px]:inline">
          {BRAND.name}
        </span>
      </AppLink>
      <div className="ml-auto flex items-center gap-2">
        {actions}
        <ProfileMenu user={user} signOut={signOut} />
      </div>
    </header>
  );
}
