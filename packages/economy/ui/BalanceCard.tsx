"use client";

import { BRAND, formatCurrency } from "@app/config/brand";
import { useEffect, useRef, useState } from "react";
import { CurrencyIcon } from "./CurrencyIcon";

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
    <p
      className="bg-surface border-border inline-flex items-center gap-1.5 self-start rounded-full border py-1 pr-3 pl-1"
      title={`Solde : ${formatCurrency(balance)}`}
    >
      <CurrencyIcon decorative className="size-6" />
      <span className="sr-only">Solde : </span>
      <span className="text-text text-sm font-bold tabular-nums">{number.format(shown)}</span>
    </p>
  );
}
