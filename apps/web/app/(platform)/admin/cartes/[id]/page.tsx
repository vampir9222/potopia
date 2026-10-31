import { getCard, listCards, listSets } from "@app/tcg";
import { CardEditor } from "@app/tcg/ui";
import { Card } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/session";
import { designFonts } from "../../../cartes/fonts";
import { confirmCardImageAction, requestCardImageAction, updateCardAction } from "../actions";
import { cardImageUrls, familiesOf } from "../images";

export const metadata: Metadata = { title: "Modifier une carte" };

export default async function AdminCardPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  const { id } = await params;
  const card = await getCard(admin, id);
  if (!card) notFound();
  const [sets, setCards, allCards] = await Promise.all([
    listSets(admin),
    listCards(admin, { setId: card.setId }),
    listCards(admin),
  ]);
  const images = await cardImageUrls(admin, [card]);
  const base = card.baseCardId ? setCards.find((c) => c.id === card.baseCardId) : null;
  const variants = setCards.filter((c) => c.baseCardId === card.id);

  return (
    <Card title={`${card.setCode} · n°${card.number} · ${card.name}`}>
      <div className={`${designFonts} flex flex-col gap-4`}>
        {(base || variants.length > 0) && (
          <p className="text-muted text-sm">
            {base ? (
              <>
                Variante de{" "}
                <Link href={`/admin/cartes/${base.id}`} className="text-accent hover:underline">
                  n°{base.number} · {base.name}
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
                      n°{v.number} · {v.name}
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
