import { getCard, listCards, listSets } from "@app/tcg";
import { CardEditor } from "@app/tcg/ui";
import { Card } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/session";
import { designFonts } from "../../../cartes/fonts";
import { confirmCardImageAction, requestCardImageAction, updateCardAction } from "../actions";
import { MoveCardForm } from "../forms";
import { cardImageUrls, familiesOf } from "../images";

export const metadata: Metadata = { title: "Modifier une carte" };

export default async function AdminCardPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  const { id } = await params;
  const card = await getCard(admin, id);
  if (!card) notFound();
  const [sets, allCards] = await Promise.all([listSets(admin), listCards(admin)]);
  const setCards = allCards.filter((c) => c.setId === card.setId);
  const images = await cardImageUrls(admin, [card]);
  const base = card.baseCardId ? allCards.find((c) => c.id === card.baseCardId) : null;
  const variants = allCards.filter((c) => c.baseCardId === card.id);
  const siblings = card.ideaId
    ? allCards.filter((c) => c.ideaId === card.ideaId && c.id !== card.id)
    : [];
  const place = card.setCode ? `${card.setCode} · n°${card.number}` : "Réserve";
  const targets = [
    ...(card.setId ? [{ id: "", label: "Réserve (hors set)" }] : []),
    ...sets
      .filter((s) => s.id !== card.setId)
      .map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` })),
  ];

  return (
    <Card title={`${place} · ${card.name}`}>
      <div className={`${designFonts} flex flex-col gap-4`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="text-muted">
            {card.setCode
              ? `Dans le set ${card.setCode} : ira en prod avec lui.`
              : "Dans la réserve : n'ira pas en prod tant qu'elle n'est pas dans un set."}
          </span>
          {targets.length > 0 && <MoveCardForm cardId={card.id} targets={targets} />}
        </div>
        {card.ideaId && (
          <p className="text-muted text-sm">
            Tirée d&apos;une{" "}
            <Link href={`/admin/ideas/${card.ideaId}`} className="text-accent hover:underline">
              idée de la boîte à idées
            </Link>
            {siblings.length > 0 && (
              <>
                , comme{" "}
                {siblings.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ", "}
                    <Link href={`/admin/cartes/${c.id}`} className="text-accent hover:underline">
                      {c.name}
                    </Link>
                  </span>
                ))}
              </>
            )}
            . Ce lien sert seulement à la gestion.
          </p>
        )}
        {(base || variants.length > 0) && (
          <p className="text-muted text-sm">
            {base ? (
              <>
                Variante de{" "}
                <Link href={`/admin/cartes/${base.id}`} className="text-accent hover:underline">
                  {base.name}
                </Link>
                .
              </>
            ) : (
              <>
                Variantes :{" "}
                {variants.map((v, i) => (
                  <span key={v.id}>
                    {i > 0 && ", "}
                    <Link href={`/admin/cartes/${v.id}`} className="text-accent hover:underline">
                      {v.name}
                    </Link>
                  </span>
                ))}
                .
              </>
            )}
          </p>
        )}
        <CardEditor
          card={card}
          sets={sets}
          families={familiesOf(allCards)}
          imageUrl={images.get(card.id) ?? null}
          setSize={setCards.length}
          save={updateCardAction.bind(null, card.id)}
          upload={{
            request: requestCardImageAction,
            confirm: confirmCardImageAction.bind(null, card.id),
          }}
        />
        <Link href="/admin/cartes" className="text-muted text-sm hover:underline">
          ← Toutes les cartes
        </Link>
      </div>
    </Card>
  );
}
