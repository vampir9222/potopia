"use client";

import { BRAND, formatCurrency } from "@app/config/brand";
import { useEffect, useRef, useState } from "react";

type Props = {
  balance: number;
};

const number = new Intl.NumberFormat(BRAND.locale);
const DURATION_MS = 900;

/** Fait défiler le nombre affiché vers `target` (instantané si moins d'animations demandé). */
function useCountUp(target: number): number {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = reduced ? 1 : Math.min(1, (now - t0) / DURATION_MS);
      const eased = 1 - (1 - p) ** 3;
      setShown(Math.round(start + (target - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return shown;
}

export function BalanceCard({ balance }: Props) {
  const shown = useCountUp(balance);

  return (
    <div className="border-accent/30 bg-bg/60 rounded-theme relative flex items-center gap-3 overflow-hidden border p-3">
      <span
        aria-hidden
        className="text-on-accent grid size-10 place-items-center rounded-full bg-(image:--accent-gradient) text-xs font-black shadow-[0_0_14px_-2px_var(--accent)]"
      >
        {BRAND.currency.symbol}
      </span>
      <div className="min-w-0">
        <p className="text-muted text-xs">Solde</p>
        <p
          className="font-display text-gradient text-2xl font-bold tabular-nums"
          title={formatCurrency(balance)}
        >
          {number.format(shown)}
        </p>
      </div>
    </div>
  );
}
