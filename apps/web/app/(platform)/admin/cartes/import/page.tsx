import { Card } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentAdmin } from "@/lib/session";
import { ImportForm } from "./ImportForm";

export const metadata: Metadata = { title: "Importer des cartes" };

const EXAMPLE = `{
  "set": { "code": "S1", "name": "Set 1" },
  "cards": [
    {
      "ideaId": "<id de l'idée, facultatif>",
      "name": "Nom de la carte",
      "rarity": "common",
      "type": "Créature",
      "family": "Grenouilles",
      "cost": 2,
      "power": 3,
      "effectKey": "reveal_debuff_strongest_enemy",
      "effectParams": { "amount": 2 },
      "effectText": "",
      "flavor": "Description en italique."
    }
  ]
}`;

export default async function ImportCardsPage() {
  await getCurrentAdmin();
  return (
    <Card title="Importer des cartes">
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-muted">
          Le set est créé s&apos;il n&apos;existe pas, et les cartes prennent les numéros suivants.
          Une carte dont l&apos;idée a déjà une carte est ignorée : réimporter le même fichier ne
          crée pas de doublon et ne touche pas aux cartes modifiées ici. Une seule erreur annule
          tout l&apos;import, avec la carte fautive dans le message.
        </p>
        <ImportForm />
        <details>
          <summary className="text-muted cursor-pointer">Format du fichier</summary>
          <pre className="bg-surface border-border mt-2 overflow-x-auto rounded-md border p-3 text-xs">
            {EXAMPLE}
          </pre>
          <p className="text-muted mt-2">
            Raretés : common, uncommon, rare, epic, legendary, sr, ssr. Mana de 0 à 6. Sans effet :
            omettre <code>effectKey</code>. Texte de l&apos;effet vide : proposé à partir de
            l&apos;effet.
          </p>
        </details>
        <Link href="/admin/cartes" className="text-muted hover:underline">
          ← Toutes les cartes
        </Link>
      </div>
    </Card>
  );
}
