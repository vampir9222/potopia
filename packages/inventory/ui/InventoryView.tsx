import { Card } from "@app/ui";
import { EMERALDS, emeraldSrc, hasAllEmeralds } from "../src/catalog";

/**
 * Page « Mon inventaire » : les 7 Émeraudes du Chaos (en noir tant qu'elles ne sont pas trouvées,
 * avec un indice), puis les hauts faits à venir.
 */
export function InventoryView({ items }: { items: readonly string[] }) {
  const count = EMERALDS.filter((e) => items.includes(e.id)).length;
  const complete = hasAllEmeralds(items);
  return (
    <div className="flex flex-col gap-6">
      <Card title="Émeraudes du Chaos">
        <p className="text-muted text-sm">
          {complete
            ? "Les 7 sont réunies : clique sur Sonic dans le header pour voir ce qu'elles font."
            : "Sept émeraudes sont cachées un peu partout sur le site. Ouvre l'œil…"}
        </p>
        <p className="mt-1 text-sm font-semibold">
          {count} / {EMERALDS.length}
        </p>
        <ul className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-7">
          {EMERALDS.map((e) => {
            const owned = items.includes(e.id);
            return (
              <li
                key={e.id}
                title={owned ? e.name : `Indice : ${e.hint}`}
                className="rounded-theme flex flex-col items-center gap-2 border border-(--frame) p-3 text-center"
              >
                <img
                  src={emeraldSrc(e.color)}
                  alt={owned ? e.name : "Émeraude pas encore trouvée"}
                  width={42}
                  height={42}
                  className={owned ? "emerald-owned" : "emerald-locked"}
                  style={{ imageRendering: "pixelated" }}
                />
                <span className={owned ? "text-text text-xs" : "text-muted text-xs italic"}>
                  {owned ? e.name : e.hint}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Hauts faits">
        <p className="text-muted text-sm">Bientôt : des exploits à débloquer en jouant.</p>
        <ul className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-7" aria-hidden>
          {Array.from({ length: 7 }, (_, i) => (
            <li
              key={i}
              className="rounded-theme bg-surface/60 grid aspect-square place-items-center border border-dashed border-(--frame) text-lg opacity-50"
            >
              ?
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
