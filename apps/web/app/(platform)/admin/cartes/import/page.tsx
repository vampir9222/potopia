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
      "effectKey": "reveal_debuff_weakest_enemy_silence",
      "effectParams": { "amount": 2 },
      "effectText": "",
      "flavor": "Description en italique."
    }
  ]
}`;

const UPDATE_EXAMPLE = `{
  "updates": [
    {
      "ideaId": "<id de l'idée de la carte>",
      "name": "Nom de la carte (pour départager si l'idée a plusieurs cartes)",
      "cost": 6,
      "power": 10,
      "effectKey": "reveal_move_allies_left",
      "effectParams": {},
      "effectText": "Révélation : SPINNING SPINNING ! Tes autres cartes passent à gauche."
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
        <p className="text-muted">
          Un fichier avec <code>updates</code> au lieu de <code>cards</code> met à jour des cartes
          existantes, retrouvées par leur idée : seuls le coût, la puissance et l&apos;effet
          changent (nom, illustration, cadrage et numéro sont gardés).
        </p>
        <ImportForm />
        <details>
          <summary className="text-muted cursor-pointer">Format du fichier</summary>
          <pre className="bg-surface border-border mt-2 overflow-x-auto rounded-md border p-3 text-xs">
            {EXAMPLE}
          </pre>
          <p className="text-muted mt-2">
            Raretés : common, uncommon, rare, epic, legendary, sr, ssr. Mana de 0 à 8. Sans effet :
            omettre <code>effectKey</code>. Texte de l&apos;effet vide : proposé à partir de
            l&apos;effet.
          </p>
        </details>
        <details>
          <summary className="text-muted cursor-pointer">Format d&apos;une mise à jour</summary>
          <pre className="bg-surface border-border mt-2 overflow-x-auto rounded-md border p-3 text-xs">
            {UPDATE_EXAMPLE}
          </pre>
          <p className="text-muted mt-2">
            Chaque champ est facultatif sauf <code>ideaId</code> : un champ absent garde sa valeur.
            Un nouvel effet sans texte prend le texte proposé par le catalogue.
          </p>
        </details>
        <Link href="/admin/cartes" className="text-muted hover:underline">
          ← Toutes les cartes
        </Link>
      </div>
    </Card>
  );
}
