"use client";

import { cx } from "@app/ui";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { EMERALDS, emeraldId, emeraldSrc, type EmeraldColor } from "../src/catalog";

type Collect = (itemId: string) => Promise<{ isNew: boolean; emeralds: number }>;

type Ctx = {
  found: ReadonlySet<string>;
  pick: (color: EmeraldColor) => void;
};

const EmeraldsContext = createContext<Ctx | null>(null);

/**
 * Les émeraudes déjà trouvées par le membre, et le ramassage (server action passée par l'app).
 * Posé une fois dans le layout : chaque `HiddenEmerald` des pages s'y branche.
 */
export function EmeraldsProvider({
  found: initial,
  collect,
  children,
}: {
  found: readonly string[];
  collect: Collect;
  children: ReactNode;
}) {
  const [found, setFound] = useState<ReadonlySet<string>>(() => new Set(initial));
  const [toast, setToast] = useState<{ text: string; color: EmeraldColor } | null>(null);

  // le serveur fait foi : la liste rafraîchie par le layout remplace l'état local
  useEffect(() => setFound(new Set(initial)), [initial]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const pick = useCallback(
    (color: EmeraldColor) => {
      const id = emeraldId(color);
      setFound((f) => new Set(f).add(id));
      collect(id)
        .then(({ isNew, emeralds }) => {
          if (!isNew) return;
          setToast({
            color,
            text:
              emeralds === EMERALDS.length
                ? "Les 7 Émeraudes du Chaos ! Clique sur Sonic, dans le header…"
                : `Émeraude du Chaos trouvée ! (${emeralds}/${EMERALDS.length})`,
          });
        })
        .catch(() =>
          setFound((f) => {
            const next = new Set(f);
            next.delete(id);
            return next;
          }),
        );
    },
    [collect],
  );

  const value = useMemo(() => ({ found, pick }), [found, pick]);
  return (
    <EmeraldsContext.Provider value={value}>
      {children}
      {toast && (
        <div
          role="status"
          className="animate-rise border-accent/40 bg-surface text-text fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2 text-sm shadow-2xl"
        >
          <img
            src={emeraldSrc(toast.color)}
            alt=""
            width={21}
            height={21}
            className="emerald-spin"
            style={{ imageRendering: "pixelated" }}
          />
          {toast.text}
        </div>
      )}
    </EmeraldsContext.Provider>
  );
}

/**
 * Une Émeraude du Chaos cachée dans une page : petite, presque transparente, un éclat de temps
 * en temps. Un clic la ramasse (une seule fois par membre). Rien hors d'un `EmeraldsProvider`.
 */
export function HiddenEmerald({ color, className }: { color: EmeraldColor; className?: string }) {
  const ctx = useContext(EmeraldsContext);
  const [burst, setBurst] = useState(false);
  if (!ctx) return null;
  if (ctx.found.has(emeraldId(color)) && !burst) return null;
  return (
    <button
      type="button"
      aria-label="Un éclat brillant"
      onClick={() => {
        setBurst(true);
        ctx.pick(color);
        setTimeout(() => setBurst(false), 700);
      }}
      disabled={burst}
      className={cx("emerald-hidden inline-grid shrink-0 place-items-center", className)}
    >
      <img
        src={emeraldSrc(color)}
        alt=""
        width={21}
        height={21}
        className={burst ? "emerald-burst" : undefined}
        style={{ imageRendering: "pixelated" }}
      />
    </button>
  );
}
