"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * Un clic sur la carte l'ouvre en grand au centre de l'écran (toujours inclinable). Un clic à côté,
 * le bouton ou Échap la referme. Basé sur <dialog> : le navigateur gère le focus et le fond.
 */
export function Zoomable({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    if (!dialog.open) dialog.showModal();
    // Taille d'affichage : la plus grande qui tient à l'écran (carte de 300 × 420), au plus ×2.
    const scale = Math.min(2, (window.innerHeight - 96) / 420, (window.innerWidth - 48) / 300);
    // La page réduit les planches avec `zoom` : on compense pour que la carte zoomée garde sa taille.
    const parent = dialog.parentElement as (HTMLElement & { currentCSSZoom?: number }) | null;
    const inherited = parent?.currentCSSZoom ?? 1;
    dialog.style.zoom = String(Math.max(scale, 1) / inherited);
  }, [open]);

  return (
    <>
      <div
        role="button"
        tabIndex={-1}
        title="Cliquer pour agrandir"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") setOpen(true);
        }}
        style={{ flexShrink: 0, cursor: "zoom-in" }}
      >
        {children}
      </div>
      <dialog
        ref={ref}
        aria-label="Carte agrandie"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) ref.current?.close();
        }}
        className="m-auto overflow-visible bg-transparent p-0 backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        {open && (
          <div style={{ position: "relative", padding: 16 }}>
            {children}
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Fermer"
              style={{ position: "absolute", top: -6, right: -6 }}
              className="flex size-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}
