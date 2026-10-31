import { CARD_RARITIES, CARD_RARITY_LABELS, listCards, listSets } from "@app/tcg";
import { GameCard, GameCardDefs } from "@app/tcg/ui";
import { buttonClasses, Card, cx, EmptyState } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentAdmin } from "@/lib/session";
import { designFonts } from "../../cartes/fonts";
import { MoveCardsForm, NewSetForm } from "./forms";
import { cardImageUrls } from "./images";

export const metadata: Metadata = { title: "Cartes" };

/** Valeur de `?set=` pour la réserve (cartes hors set). */
const RESERVE = "reserve";

export default async function AdminCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string }>;
}) {
  const admin = await getCurrentAdmin();
  const [sets, all] = await Promise.all([listSets(admin), listCards(admin)]);
  const { set: code } = await searchParams;
  const reserveView = code === RESERVE || (code === undefined && sets.length === 0);
  const current = reserveView ? null : (sets.find((s) => s.code === code) ?? sets.at(-1) ?? null);
  const cards = all.filter((c) => c.setId === (current?.id ?? null));
  const images = await cardImageUrls(admin, cards);
  const counts = CARD_RARITIES.map((r) => [r, cards.filter((c) => c.rarity === r).length] as const);
  const reserveCount = all.filter((c) => c.setId === null).length;

  const tabs = [
    ...sets.map((s) => ({
      href: `/admin/cartes?set=${s.code}`,
      label: `${s.code} · ${s.name} (${all.filter((c) => c.setId === s.id).length})`,
      active: s.id === current?.id,
    })),
    {
      href: `/admin/cartes?set=${RESERVE}`,
      label: `Réserve (${reserveCount})`,
      active: reserveView,
    },
  ];
  const targets = [
    ...(reserveView ? [] : [{ id: "", label: "Réserve (hors set)" }]),
    ...sets
      .filter((s) => s.id !== current?.id)
      .map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` })),
  ];

  return (
    <div className={`${designFonts} flex flex-col gap-4`}>
      <Card
        title="Cartes"
        action={
          <div className="flex flex-wrap gap-2">
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
            <Link
              href={`/admin/cartes/nouvelle${current ? `?set=${current.code}` : ""}`}
              className={buttonClasses({ size: "sm" })}
            >
              Nouvelle carte
            </Link>
          </div>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-muted">
            Une carte rangée dans un set y prend un numéro et ira en prod avec lui ; la réserve
            garde les cartes en attente. Coche des cartes pour les déplacer d&apos;un coup.
          </p>
          <nav className="flex flex-wrap gap-2" aria-label="Sets et réserve">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                aria-current={t.active ? "page" : undefined}
                className={cx(
                  "rounded-full border px-3 py-1",
                  t.active ? "border-accent text-text" : "border-border text-muted",
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          {cards.length > 0 && (
            <p className="text-muted">
              {current ? `${current.code} · ${current.name}` : "Réserve"} : {cards.length} carte
              {cards.length > 1 ? "s" : ""}
              {counts
                .filter(([, n]) => n > 0)
                .map(([r, n]) => ` · ${n} ${CARD_RARITY_LABELS[r].toLowerCase()}`)
                .join("")}
              .
            </p>
          )}
          <details>
            <summary className="text-muted cursor-pointer">Nouveau set</summary>
            <div className="mt-2">
              <NewSetForm />
            </div>
          </details>
        </div>
      </Card>

      <GameCardDefs />
      {cards.length === 0 ? (
        <Card>
          <EmptyState
            title={current ? "Aucune carte dans ce set" : "La réserve est vide"}
            description="Crée une carte, importe un fichier (JSON) ou déplace des cartes ici."
          />
        </Card>
      ) : (
        <MoveCardsForm targets={targets}>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(400px,100%),1fr))] gap-4">
            {cards.map((card) => (
              <li
                key={card.id}
                className="flex flex-col items-center gap-1"
                // Le navigateur ne dessine pas les cartes hors de l'écran (défilement fluide).
                style={{ contentVisibility: "auto", containIntrinsicSize: "auto 585px" }}
              >
                <Link
                  href={`/admin/cartes/${card.id}`}
                  aria-label={`Modifier ${card.name}`}
                  className="flex flex-col items-center"
                >
                  {/* Aperçu agrandi d'un tiers (400 × 560) : la carte fait 300 × 420. */}
                  <div style={{ zoom: 4 / 3 }} className="pointer-events-none">
                    <GameCard
                      card={card}
                      imageUrl={images.get(card.id) ?? null}
                      setSize={cards.length}
                    />
                  </div>
                </Link>
                <label className="text-muted flex items-center gap-1.5 text-xs">
                  <input type="checkbox" name="ids" value={card.id} />
                  {card.number ?? "—"} · {CARD_RARITY_LABELS[card.rarity]}
                  {card.baseCardId ? " · variante" : ""}
                </label>
              </li>
            ))}
          </ul>
        </MoveCardsForm>
      )}
    </div>
  );
}
