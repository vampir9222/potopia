"use client";

import { Sheet } from "@app/ui";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

/** Bouton du header (petits écrans) qui ouvre la colonne compte dans un panneau latéral. */
export function MobileMenu({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Page sur laquelle le panneau a été ouvert : changer de page (lien du menu) le referme.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenedOn(pathname)}
        aria-label="Ouvrir le menu"
        className="text-muted hover:bg-surface hover:text-text rounded-md p-2 lg:hidden"
      >
        <Menu size={20} />
      </button>
      <Sheet open={open} onClose={() => setOpenedOn(null)} title="Mon compte">
        {children}
      </Sheet>
    </>
  );
}
