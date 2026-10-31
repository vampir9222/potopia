import { CARD_RARITIES, CARD_RARITY_LABELS, listCards, listSets } from "@app/tcg";
import { GameCard, GameCardDefs } from "@app/tcg/ui";
import { buttonClasses, Card, EmptyState } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentAdmin } from "@/lib/session";
import { designFonts } from "../../cartes/fonts";
import { cardImageUrls } from "./images";

export const metadata: Metadata = { title: "Cartes" };

export default async function AdminCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string }>;
}) {
  const admin = await getCurrentAdmin();
  const sets = await listSets(admin);
  const { set: code } = await searchParams;
  const current = sets.find((s) => s.code === code) ?? sets.at(-1) ?? null;
  const cards = current ? await listCards(admin, { setId: current.id }) : [];
  const images = await cardImageUrls(admin, cards);
  const counts = CARD_RARITIES.map((r) => [r, cards.filter((c) => c.rarity === r).length] as const);

  return (
    <div className={`${designFonts} flex flex-col gap-4`}>
      <Card
        title="Cartes"
        action={
          <div className="flex gap-2">
            <Link
              href="/admin/cartes/import"
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Importer (JSON)
            </Link>
            {current && (
              <Link
                href={`/admin/cartes/illustrations?set=${current.code}`}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                Illustrations
              </Link>
            )}
            {current && (
              <Link href="/admin/cartes/nouvelle" className={buttonClasses({ size: "sm" })}>
                Nouvelle carte
              </Link>
            )}
          </div>
        }
      >
        {sets.length > 1 && (
          <nav className="mb-3 flex flex-wrap gap-2" aria-label="Sets">
            {sets.map((s) => (
              <Link
                key={s.id}
                href={`/admin/cartes?set=${s.code}`}
                aria-current={s.id === current?.id ? "page" : undefined}
                className={
                  s.id === current?.id
                    ? "border-accent text-text rounded-full border px-3 py-1 text-sm"
                    : "border-border text-muted rounded-full border px-3 py-1 text-sm"
                }
              >
                {s.code} · {s.name}
              </Link>
            ))}
          </nav>
        )}
        {current ? (
          <p className="text-muted text-sm">
            {current.code} · {current.name} : {cards.length} carte{cards.length > 1 ? "s" : ""}
            {counts
              .filter(([, n]) => n > 0)
              .map(([r, n]) => ` · ${n} ${CARD_RARITY_LABELS[r].toLowerCase()}`)
              .join("")}
            . Clique sur une carte pour la modifier.
          </p>
        ) : (
          <EmptyState
            title="Aucun set pour l'instant"
            description="Importe un fichier de cartes (JSON) : son set est créé au passage."
          />
        )}
      </Card>

      <GameCardDefs />
      {cards.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
          {cards.map((card) => (
            <li key={card.id}>
              <Link
                href={`/admin/cartes/${card.id}`}
                className="flex flex-col items-center gap-1"
                aria-label={`Modifier ${card.name}`}
              >
                {/* Aperçu réduit de moitié : la carte fait 300 × 420. */}
                <div style={{ zoom: 0.5 }} className="pointer-events-none">
                  <GameCard
                    card={card}
                    imageUrl={images.get(card.id) ?? null}
                    setSize={cards.length}
                  />
                </div>
                <span className="text-muted text-xs">
                  {card.number} · {CARD_RARITY_LABELS[card.rarity]}
                  {card.baseCardId ? " · variante" : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
