import Link from "next/link";
import { BRAND } from "@app/config/brand";
import { Card } from "@app/ui";
import { countIdeas } from "@app/ideas";
import { Coins, Layers, Lightbulb, Smile, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Administration" };

const SECTIONS = (ideasCount: number) => [
  {
    href: "/admin/goty",
    title: "GOTY Party",
    description: "Éditions annuelles, participants et organisation de la soirée.",
    icon: Trophy,
  },
  {
    href: "/admin/economy",
    title: "Monnaie",
    description: `Soldes des membres, crédits et débits de ${BRAND.currency.plural}.`,
    icon: Coins,
  },
  {
    href: "/admin/ideas",
    title: "Boîte à idées",
    description: `${ideasCount} idée${ideasCount > 1 ? "s" : ""} reçue${ideasCount > 1 ? "s" : ""}.`,
    icon: Lightbulb,
  },
  {
    href: "/admin/cartes",
    title: "Cartes",
    description: "Cartes du jeu : créer, modifier, importer.",
    icon: Layers,
  },
  {
    href: "/admin/mascotte",
    title: "Mascotte",
    description: "Images de la mascotte (stockage privé).",
    icon: Smile,
  },
];

export default async function AdminPage() {
  // Le layout vérifie déjà, mais une page peut être rendue sans lui : on revérifie.
  await getCurrentAdmin();
  const sections = SECTIONS(await countIdeas());
  return (
    <Card title="Administration">
      <ul className="grid gap-3 sm:grid-cols-2">
        {sections.map(({ href, title, description, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="border-border hover:border-accent rounded-theme flex gap-3 border p-4 transition-colors"
            >
              <Icon size={24} className="text-accent shrink-0" aria-hidden />
              <span>
                <span className="text-text block text-sm font-medium">{title}</span>
                <span className="text-muted text-sm">{description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
