"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

type Props = {
  /** Nombre de lignes visibles avant défilement. */
  rows: number;
  className?: string;
  children: ReactNode;
};

/**
 * Liste qui montre exactement `rows` éléments puis défile : la hauteur est mesurée sur la ligne
 * suivante, donc juste même quand une phrase passe sur deux lignes.
 */
export function VisibleRows({ rows, className, children }: Props) {
  const ref = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    const fit = () => {
      const next = list.children[rows] as HTMLElement | undefined;
      // La liste est `relative` : offsetTop se mesure depuis son bord, hors animations (transform).
      list.style.maxHeight = next ? `${next.offsetTop}px` : "";
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(list);
    return () => observer.disconnect();
  }, [rows]);

  return (
    <ul ref={ref} className={`relative overflow-y-auto ${className ?? ""}`}>
      {children}
    </ul>
  );
}
