import { LoaderCircle } from "lucide-react";
import { Mascot } from "@/components/Mascot";

/**
 * Affiché pendant qu'une page de la plateforme se charge (le header et la colonne de gauche restent
 * en place) : la mascotte qui rebondit, seule au centre (une roue qui tourne si elle n'a pas
 * d'image). Limite documentée par Next : sans Cache Components, la navigation attend que le layout
 * `(platform)` ait fini ses requêtes (cookies, notifications…) avant de montrer cet écran ; il ne
 * couvre donc que le temps de rendu de la page elle-même.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy
      aria-label="Chargement"
      className="flex min-h-[60dvh] items-center justify-center"
    >
      <Mascot
        mood="chargement"
        height={120}
        fallback={<LoaderCircle size={32} className="text-muted animate-spin" aria-hidden />}
      />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
