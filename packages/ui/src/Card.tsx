import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

type Props = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  /** Élément à droite du titre (lien « Tout voir », bouton…). */
  action?: ReactNode;
};

export function Card({ title, action, className, children, ...props }: Props) {
  return (
    <section
      className={cx("border-border bg-surface rounded-theme border p-4", className)}
      {...props}
    >
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-text text-sm font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
