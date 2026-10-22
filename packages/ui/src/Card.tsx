import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

type Props = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  /** Élément à droite du titre (lien « Tout voir », bouton…). */
  action?: ReactNode;
};

export function Card({ title, action, className, children, ...props }: Props) {
  return (
    <section className={cx("theme-frame rounded-theme p-4", className)} {...props}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title && (
            <h2 className="font-display text-accent text-sm font-semibold tracking-wider uppercase">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
