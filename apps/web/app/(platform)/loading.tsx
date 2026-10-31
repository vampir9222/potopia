import { Mascot } from "@/components/Mascot";

/**
 * Squelette affiché pendant qu'une page de la plateforme se charge (le header et la colonne de
 * gauche restent en place), avec la mascotte qui rebondit au-dessus. Limite documentée par Next :
 * sans Cache Components, la navigation attend que le layout `(platform)` ait fini ses requêtes
 * (cookies, notifications…) avant de montrer ce squelette ; il ne couvre donc que le temps de rendu
 * de la page elle-même.
 */
export default function Loading() {
  return (
    <div role="status" aria-busy className="flex flex-col gap-4" aria-label="Chargement">
      <Mascot mood="chargement" height={80} className="self-center" />
      <div className="flex animate-pulse flex-col gap-4">
        <div className="bg-surface h-5 w-48 rounded-md" />
        <div className="theme-frame rounded-theme flex flex-col gap-3 p-4">
          <div className="bg-surface h-4 w-40 rounded-md" />
          <div className="bg-surface h-3 w-full rounded-md" />
          <div className="bg-surface h-3 w-5/6 rounded-md" />
          <div className="bg-surface h-3 w-2/3 rounded-md" />
        </div>
        <div className="theme-frame rounded-theme flex flex-col gap-3 p-4">
          <div className="bg-surface h-4 w-32 rounded-md" />
          <div className="bg-surface h-24 w-full rounded-md" />
        </div>
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
