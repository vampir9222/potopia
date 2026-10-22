"use client";

import { Sheet } from "@app/ui";
import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";

/** Bouton du header (petits écrans) qui ouvre la colonne compte dans un panneau latéral. */
export function MobileMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        className="text-muted hover:bg-surface hover:text-text rounded-md p-2 lg:hidden"
      >
        <Menu size={20} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Mon compte">
        {children}
      </Sheet>
    </>
  );
}
