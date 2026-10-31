import { CARD_RARITIES, CARD_RARITY_LABELS, listCards, listSets } from "@app/tcg";
import { GameCard, GameCardDefs } from "@app/tcg/ui";
import { Button, buttonClasses, Card, cx, EmptyState, Input } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentAdmin } from "@/lib/session";
import { designFonts } from "../../cartes/fonts";
import { MoveCardsForm, NewSetForm } from "./forms";
import { cardAuthors, cardImageUrls } from "./images";

export const metadata: Metadata = { title: "Cartes" };

/** Valeur de `?set=` pour la réserve (cartes hors set). */
const RESERVE = "reserve";

/** Cartes par page : au-delà, la planche devient lourde à afficher et à faire défiler. */
const PAGE_SIZE = 24;

/** Texte comparable : minuscules, sans accents. */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export default async function AdminCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string; page?: string; q?: string }>;
}) {
  const admin = await getCurrentAdmin();
  const [sets, all] = await Promise.all([listSets(admin), listCards(admin)]);
  const { set: code, page: pageParam, q: rawQuery } = await searchParams;
  const query = (rawQuery ?? "").trim().slice(0, 60);
  const reserveView = code === RESERVE || (code === undefined && sets.length === 0);
  const current = reserveView ? null : (sets.find((s) => s.code === code) ?? sets.at(-1) ?? null);
  // Une recherche porte sur toutes les cartes (sets et réserve) : nom, type, famille, textes.
  const words = fold(query).split(/\s+/).filter(Boolean);
  const cards = words.length
    ? all.filter((c) => {
        const text = fold(
          [c.name, c.type, c.family, c.effectText, c.flavor, c.setCode, c.number].join(" "),
        );
        return words.every((w) => text.includes(w));
      })
    : all.filter((c) => c.setId === (current?.id ?? null));
  const pageCount = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1), pageCount);
  const shown = cards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const [images, authors] = await Promise.all([
    cardImageUrls(admin, shown),
    cardAuthors(admin, shown),
  ]);
  const counts = CARD_RARITIES.map((r) => [r, cards.filter((c) => c.rarity === r).length] as const);
  const reserveCount = all.filter((c) => c.setId === null).length;
  const setSizes = new Map(sets.map((s) => [s.id, all.filter((c) => c.setId === s.id).length]));

  const setParam = current ? current.code : RESERVE;
  const searchParam = query ? `&q=${encodeURIComponent(query)}` : "";
  const pager =
    pageCount > 1 ? (
      <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Pages">
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
          <Link
            key={p}
            href={`/admin/cartes?set=${setParam}${searchParam}&page=${p}`}
            aria-current={p === page ? "page" : undefined}
            className={cx(
              "rounded-md border px-2.5 py-1",
              p === page ? "border-accent text-text" : "border-border text-muted",
            )}
          >
            {(p - 1) * PAGE_SIZE + 1}–{Math.min(p * PAGE_SIZE, cards.length)}
          </Link>
        ))}
      </nav>
    ) : null;

  const tabs = [
    ...sets.map((s) => ({
      href: `/admin/cartes?set=${s.code}`,
      label: `${s.code} · ${s.name} (${all.filter((c) => c.setId === s.id).length})`,
      active: !query && s.id === current?.id,
    })),
    {
      href: `/admin/cartes?set=${RESERVE}`,
      label: `Réserve (${reserveCount})`,
      active: !query && reserveView,
    },
  ];
  const targets = [
    ...(reserveView && !query ? [] : [{ id: "", label: "Réserve (hors set)" }]),
    ...sets
      .filter((s) => query || s.id !== current?.id)
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
          <form action="/admin/cartes" role="search" className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="set" value={setParam} />
            <Input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Chercher une carte : nom, famille, effet…"
              aria-label="Chercher une carte"
              maxLength={60}
              className="max-w-sm"
            />
            <Button type="submit" variant="secondary" size="sm">
              Chercher
            </Button>
            {query && (
              <Link href={`/admin/cartes?set=${setParam}`} className="text-muted hover:underline">
                Effacer
              </Link>
            )}
          </form>
          {cards.length > 0 && (
            <p className="text-muted">
              {query
                ? `Recherche « ${query} », tous sets et réserve`
                : current
                  ? `${current.code} · ${current.name}`
                  : "Réserve"}{" "}
              : {cards.length} carte
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
            title={
              query
                ? `Aucune carte pour « ${query} »`
                : current
                  ? "Aucune carte dans ce set"
                  : "La réserve est vide"
            }
            description={
              query
                ? "La recherche porte sur le nom, le type, la famille, l'effet et la description."
                : "Crée une carte, importe un fichier (JSON) ou déplace des cartes ici."
            }
          />
        </Card>
      ) : (
        <MoveCardsForm targets={targets}>
          {pager}
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(400px,100%),1fr))] gap-4">
            {shown.map((card) => (
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
                      setSize={card.setId ? setSizes.get(card.setId) : undefined}
                      author={authors.get(card.id)}
                      still
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
          {pager}
        </MoveCardsForm>
      )}
    </div>
  );
}
