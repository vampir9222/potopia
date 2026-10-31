import { getUser } from "@app/core";
import { getIdea } from "@app/ideas";
import { CARD_LIMITS, CARD_RARITIES, listCards, listSets } from "@app/tcg";
import { CardEditor, type CardFields } from "@app/tcg/ui";
import { Card } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/session";
import { designFonts } from "../../../cartes/fonts";
import { createCardAction } from "../actions";
import { familiesOf } from "../images";

export const metadata: Metadata = { title: "Nouvelle carte" };

/** Champs pré-remplis à partir d'une idée (le reste se règle à la main). */
function fromIdea(idea: NonNullable<Awaited<ReturnType<typeof getIdea>>>): Partial<CardFields> {
  const description = idea.description.trim();
  // « Alice / Bob » → la première personne citée sert de famille.
  const family = (idea.concernedPeople ?? "").split(/[/,&]| et /)[0]?.trim() ?? "";
  return {
    name: idea.title.trim().slice(0, CARD_LIMITS.name),
    rarity: CARD_RARITIES.find((r) => r === idea.suggestedRarity) ?? "common",
    family: family.slice(0, CARD_LIMITS.family),
    flavor: description === "--" ? "" : description.slice(0, CARD_LIMITS.flavor),
  };
}

export default async function NewCardPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string; idee?: string }>;
}) {
  const admin = await getCurrentAdmin();
  const { set: code, idee } = await searchParams;
  const [sets, cards, idea] = await Promise.all([
    listSets(admin),
    listCards(admin),
    idee ? getIdea(admin, idee) : null,
  ]);
  if (idee && !idea) notFound();
  const author = idea ? await getUser(idea.authorId) : null;
  const ideaCards = idea ? cards.filter((c) => c.ideaId === idea.id) : [];
  const setSizes = Object.fromEntries(
    sets.map((s) => [s.id, cards.filter((c) => c.setId === s.id).length]),
  );

  return (
    <Card title={idea ? "Nouvelle carte à partir d'une idée" : "Nouvelle carte"}>
      <div className={`${designFonts} flex flex-col gap-4`}>
        <p className="text-muted text-sm">
          Dans un set, la carte prend le numéro suivant ; dans la réserve, elle attend sans numéro.
          L&apos;illustration s&apos;envoie (et se cadre) une fois la carte créée.
        </p>
        {idea && (
          <div className="border-border bg-surface flex flex-col gap-1 rounded-lg border p-3 text-sm">
            <p className="text-text font-medium">
              Idée d&apos;origine :{" "}
              <Link href={`/admin/ideas/${idea.id}`} className="text-accent hover:underline">
                {idea.title}
              </Link>
            </p>
            {idea.effectIdea && <p className="text-muted">Idée d&apos;effet : {idea.effectIdea}</p>}
            <p className="text-muted">
              Nom, rareté, famille et description sont pré-remplis ; tant que la carte n&apos;a pas
              d&apos;illustration propre, elle montre l&apos;image de l&apos;idée. Le lien sert
              seulement à la gestion : il n&apos;a aucun effet en jeu.
            </p>
            {ideaCards.length > 0 && (
              <p className="text-danger">
                Cette idée a déjà {ideaCards.length} carte{ideaCards.length > 1 ? "s" : ""} :{" "}
                {ideaCards.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ", "}
                    <Link href={`/admin/cartes/${c.id}`} className="underline">
                      {c.name}
                    </Link>
                  </span>
                ))}
                . Coche « Créer quand même » en bas pour en ajouter une autre.
              </p>
            )}
          </div>
        )}
        <CardEditor
          card={null}
          sets={sets}
          families={familiesOf(cards)}
          imageUrl={idea?.imageKey ? `/api/admin/ideas/${idea.id}/image` : null}
          author={author?.name}
          setSizes={setSizes}
          defaultSetId={sets.find((s) => s.code === code)?.id ?? null}
          fromIdea={
            idea
              ? { id: idea.id, initial: fromIdea(idea), hasCards: ideaCards.length > 0 }
              : undefined
          }
          save={createCardAction}
        />
      </div>
    </Card>
  );
}
