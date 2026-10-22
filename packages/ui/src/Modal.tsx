"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "./cx";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** `modal` : centré. `sheet` : panneau latéral gauche (menu mobile). */
  variant?: "modal" | "sheet";
  className?: string;
};

/**
 * Basé sur `<dialog>` : le navigateur gère le focus, Échap et l'inertie du reste de la page.
 * Un clic sur le fond ferme aussi.
 */
export function Modal({ open, onClose, title, children, variant = "modal", className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cx(
        "theme-frame text-text fixed backdrop:bg-black/70 backdrop:backdrop-blur-sm",
        variant === "modal"
          ? "rounded-theme m-auto w-[min(32rem,calc(100vw-2rem))] border p-0"
          : "m-0 h-dvh max-h-none w-[min(20rem,85vw)] border-r p-0",
        className,
      )}
    >
      <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="font-display text-accent text-sm font-semibold tracking-wider uppercase">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="text-muted hover:text-text rounded-md p-1"
        >
          <X size={18} />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  );
}

/** Panneau latéral (menu mobile). */
export function Sheet(props: Omit<Props, "variant">) {
  return <Modal {...props} variant="sheet" />;
}
