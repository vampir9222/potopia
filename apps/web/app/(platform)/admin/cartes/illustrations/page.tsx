import { listCards, listSets } from "@app/tcg";
import { CardImagesUpload } from "@app/tcg/ui";
import { Card } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentAdmin } from "@/lib/session";
import { confirmCardImageAction, requestCardImageAction } from "../actions";

export const metadata: Metadata = { title: "Illustrations des cartes" };

export default async function CardImagesPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string }>;
}) {
  const admin = await getCurrentAdmin();
  const sets = await listSets(admin);
  const { set: code } = await searchParams;
  const current = sets.find((s) => s.code === code) ?? sets.at(-1) ?? null;
  const cards = current ? await listCards(admin, { setId: current.id }) : [];

  return (
    <Card title={`Illustrations${current ? ` · ${current.code} · ${current.name}` : ""}`}>
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-muted">
          Choisis plusieurs images d&apos;un coup : chacune va sur la carte dont elle porte le
          numéro, et remplace son illustration actuelle. Une carte sans illustration propre montre
          l&apos;image de son idée.
        </p>
        {current ? (
          <CardImagesUpload
            cards={cards.map((c) => ({ id: c.id, number: c.number, name: c.name }))}
            request={requestCardImageAction}
            confirm={confirmCardImageAction}
          />
        ) : (
          <p className="text-muted">
            Aucun set pour l&apos;instant : importe d&apos;abord des cartes.
          </p>
        )}
        <Link href="/admin/cartes" className="text-muted hover:underline">
          ← Toutes les cartes
        </Link>
      </div>
    </Card>
  );
}
