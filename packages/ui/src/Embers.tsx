import type { CSSProperties } from "react";
import { cx } from "./cx";

/** Valeur pseudo-aléatoire stable dans [0, 1) : même rendu côté serveur et client. */
function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

type Props = {
  /** Nombre de braises. */
  count?: number;
  className?: string;
};

/**
 * Braises dorées qui montent lentement, en fond. Décoratif uniquement (aria-hidden, aucun clic),
 * coupé si l'appareil demande moins d'animations.
 */
export function Embers({ count = 18, className }: Props) {
  return (
    <div
      aria-hidden
      className={cx("pointer-events-none fixed inset-0 -z-10 overflow-hidden", className)}
    >
      {Array.from({ length: count }, (_, i) => {
        const size = 2 + seeded(i, 1) * 4;
        const style = {
          left: `${seeded(i, 2) * 100}%`,
          width: size,
          height: size,
          animationDuration: `${14 + seeded(i, 3) * 16}s`,
          animationDelay: `${-seeded(i, 4) * 30}s`,
          "--ember-drift": `${(seeded(i, 5) - 0.5) * 160}px`,
        } as CSSProperties;
        return <span key={i} className="ember" style={style} />;
      })}
    </div>
  );
}
