import { Card } from "@app/ui";
import { EmeraldCircle } from "./EmeraldCircle";

/** Page « Mon inventaire » : les 7 Émeraudes du Chaos, puis les hauts faits à venir. */
export function InventoryView({ items }: { items: readonly string[] }) {
  return (
    <div className="flex flex-col gap-6">
      <Card title="Chaos Emerald">
        <EmeraldCircle items={items} />
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
